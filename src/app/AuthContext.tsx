import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, clearSuperadminClientMode, get, isSuperadminClientMode, onSessionExpired, post } from '@/lib/api'
import { primaryRole, type UserRole } from '@/lib/roles'

interface ApiUser {
  id: string
  kind: 'member' | 'staff'
  person_type: 'natural' | 'legal' | null
  member_number: string | null
  first_name: string
  last_name: string
  email: string
  phone: string | null
  status: string
  pernum: string | null
  roles?: string[]
  permissions?: string[]
  organization?: { legal_name: string } | null
}

export interface AuthUser {
  id: string
  name: string
  email: string
  pernum: string
  role: UserRole
  permissions: string[]
  status: string
  personType: 'natural' | 'legal' | null
}

export interface OtpChallenge {
  challengeId: string
  sentTo: string
  expiresAt: string
}

export type LoginOutcome = { status: 'authenticated'; redirectTo: string } | ({ status: 'otp_required' } & OtpChallenge)

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (identifier: string, password: string) => Promise<LoginOutcome>
  verifyOtp: (challengeId: string, code: string) => Promise<{ redirectTo: string }>
  resendOtp: (challengeId: string) => Promise<OtpChallenge>
  verifyEmail: (challengeId: string, code: string) => Promise<{ redirectTo: string }>
  refresh: () => Promise<AuthUser | null>
  logout: () => Promise<void>
  can: (permission: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

function toAuthUser(api: ApiUser): AuthUser {
  const name = api.organization?.legal_name ?? `${api.first_name} ${api.last_name}`.trim()
  return {
    id: api.id,
    name: name || api.email,
    email: api.email,
    pernum: api.pernum ?? api.member_number ?? '',
    role: primaryRole(api.kind, api.roles ?? []),
    permissions: api.permissions ?? [],
    status: api.status,
    personType: api.person_type,
  }
}

export function homeFor(user: AuthUser): string {
  void user
  return '/admin'
}

interface ChallengeBody {
  challenge_id: string
  sent_to: string
  expires_at: string
}

function toChallenge(body: ChallengeBody): OtpChallenge {
  return { challengeId: body.challenge_id, sentTo: body.sent_to, expiresAt: body.expires_at }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    get<ApiUser>('/me')
      .then((profile) => active && setUser(toAuthUser(profile)))
      .catch((error: unknown) => {
        if (!(error instanceof ApiError) || error.status !== 401) console.error('Vérification de la session impossible', error)
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const clearSession = useCallback(() => {
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  useEffect(() => onSessionExpired(clearSession), [clearSession])

  const establish = useCallback(
    (profile: ApiUser): string => {
      if (profile.kind !== 'staff') {
        void post('/auth/logout').catch(() => undefined)
        throw new ApiError(403, 'NOT_STAFF', 'Cet espace est réservé aux comptes internes de la CECT.')
      }
      queryClient.clear()
      const next = toAuthUser(profile)
      setUser(next)
      return homeFor(next)
    },
    [queryClient]
  )

  const login = useCallback<AuthContextValue['login']>(
    async (identifier, password) => {
      const data = await post<{ status: string; user?: ApiUser } & Partial<ChallengeBody>>('/auth/login', { identifier, password, device_name: 'web' })
      if (data.status === 'otp_required') {
        return { status: 'otp_required', ...toChallenge(data as ChallengeBody) }
      }
      if (!data.user) throw new ApiError(500, 'INVALID_RESPONSE', 'Réponse inattendue du serveur.')
      const profile = await get<ApiUser>('/me')
      return { status: 'authenticated', redirectTo: establish(profile) }
    },
    [establish]
  )

  const verifyOtp = useCallback<AuthContextValue['verifyOtp']>(
    async (challengeId, code) => {
      await post('/auth/login/verify', { challenge_id: challengeId, code, device_name: 'web' })
      const profile = await get<ApiUser>('/me')
      return { redirectTo: establish(profile) }
    },
    [establish]
  )

  const resendOtp = useCallback<AuthContextValue['resendOtp']>(async (challengeId) => toChallenge(await post<ChallengeBody>('/auth/otp/resend', { challenge_id: challengeId })), [])

  const verifyEmail = useCallback<AuthContextValue['verifyEmail']>(
    async (challengeId, code) => {
      await post('/auth/email/verify', { challenge_id: challengeId, code, device_name: 'web' })
      const profile = await get<ApiUser>('/me')
      return { redirectTo: establish(profile) }
    },
    [establish]
  )

  const refresh = useCallback<AuthContextValue['refresh']>(async () => {
    try {
      const next = toAuthUser(await get<ApiUser>('/me'))
      setUser(next)
      return next
    } catch {
      return null
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await post('/auth/logout')
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) console.error('Déconnexion côté serveur impossible', error)
    } finally {
      const wasSuperadmin = isSuperadminClientMode()
      clearSession()
      clearSuperadminClientMode()
      if (wasSuperadmin) window.location.assign('/connexion')
    }
  }, [clearSession])

  const can = useCallback((permission: string) => Boolean(user && (user.permissions.includes('*') || user.permissions.includes(permission))), [user])

  const value = useMemo<AuthContextValue>(() => ({ user, loading, login, verifyOtp, resendOtp, verifyEmail, refresh, logout, can }), [user, loading, login, verifyOtp, resendOtp, verifyEmail, refresh, logout, can])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
