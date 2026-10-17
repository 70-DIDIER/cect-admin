import axios, { AxiosError, type AxiosRequestConfig } from 'axios'

// The SuperAdmin subdomain must use its own certificate-verified API entrypoint.
const IS_SUPERADMIN_HOST = window.location.hostname.toLowerCase().startsWith('superadmin.')
const ORIGIN = (IS_SUPERADMIN_HOST ? window.location.origin : (import.meta.env.VITE_API_URL ?? 'http://localhost:8000')).replace(/\/+$/, '')

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {},
    public readonly correlationId: string | null = null
  ) {
    super(message)
    this.name = 'ApiError'
  }

  get fieldErrors(): Record<string, string[]> {
    const fields = this.details.fields
    return fields && typeof fields === 'object' ? (fields as Record<string, string[]>) : {}
  }
}

export const http = axios.create({
  baseURL: `${ORIGIN}/api/v1`,
  withCredentials: true,
  // Requis par axios pour recopier le cookie XSRF-TOKEN vers X-XSRF-TOKEN quand l'API est sur une autre origine.
  withXSRFToken: true,
  headers: { Accept: 'application/json' },
})

let csrfReady: Promise<void> | null = null

export function ensureCsrfCookie(force = false): Promise<void> {
  if (force || !csrfReady) {
    csrfReady = axios
      .get(`${ORIGIN}/sanctum/csrf-cookie`, { withCredentials: true })
      .then(() => undefined)
      .catch((error: unknown) => {
        csrfReady = null
        throw toApiError(error)
      })
  }
  return csrfReady
}

interface ErrorBody {
  code?: string
  message?: string
  details?: Record<string, unknown>
  correlation_id?: string
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (axios.isAxiosError(error)) {
    const response = (error as AxiosError<ErrorBody>).response
    if (!response) {
      return new ApiError(0, 'NETWORK_ERROR', 'Impossible de joindre le serveur. Vérifiez votre connexion.')
    }
    const body = response.data ?? {}
    const code = body.code ?? (response.status === 419 ? 'HTTP_419' : `HTTP_${response.status}`)
    return new ApiError(response.status, code, body.message ?? 'Une erreur est survenue.', body.details ?? {}, body.correlation_id ?? (response.headers['x-correlation-id'] as string | undefined) ?? null)
  }
  return new ApiError(0, 'UNKNOWN', error instanceof Error ? error.message : 'Une erreur est survenue.')
}

type SessionExpiredListener = () => void
const listeners = new Set<SessionExpiredListener>()

export function onSessionExpired(listener: SessionExpiredListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

type StepUpHandler = () => Promise<void>
let stepUpHandler: StepUpHandler | null = null
let stepUpPending: Promise<void> | null = null

export function setStepUpHandler(handler: StepUpHandler | null): void {
  stepUpHandler = handler
}

http.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (axios.isAxiosError(error) && error.response && error.config) {
      const config = error.config as AxiosRequestConfig & { _retried?: boolean }
      if (error.response.status === 419 && !config._retried) {
        config._retried = true
        await ensureCsrfCookie(true)
        return http.request(config)
      }
      const body = error.response.data as { code?: string } | undefined
      if (error.response.status === 403 && body?.code === 'STEP_UP_REQUIRED' && stepUpHandler && !(config as { _stepUp?: boolean })._stepUp) {
        ;(config as { _stepUp?: boolean })._stepUp = true
        stepUpPending ??= stepUpHandler().finally(() => {
          stepUpPending = null
        })
        await stepUpPending
        return http.request(config)
      }
      if (error.response.status === 401 && !config.url?.startsWith('/auth/') && config.url !== '/me') {
        listeners.forEach((listener) => listener())
      }
    }
    throw toApiError(error)
  }
)

export function newIdempotencyKey(): string {
  return crypto.randomUUID()
}

export async function get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const response = await http.get<{ data: T }>(path, { params })
  return response.data.data
}

export async function post<T>(path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  await ensureCsrfCookie()
  const response = await http.post<{ data: T }>(path, body, idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined)
  return response.data.data
}

export async function put<T>(path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  await ensureCsrfCookie()
  const response = await http.put<{ data: T }>(path, body, idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined)
  return response.data.data
}

export async function getRaw<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const response = await http.get<T>(path, { params })
  return response.data
}

export function apiUrl(path: string, params?: Record<string, string>): string {
  const query = params ? `?${new URLSearchParams(params).toString()}` : ''
  return `${ORIGIN}/api/v1${path}${query}`
}

export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const response = await http.get<Blob>(path, { responseType: 'blob' })
  const disposition = String(response.headers['content-disposition'] ?? '')
  const name = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)?.[1] ?? fallbackName
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = decodeURIComponent(name)
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
