import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Panel } from '@/components/dashboard/Panel'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { useAuth } from '@/app/AuthContext'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { dateTime, ErrorLine, FIELD, LoadingBlock, LoadMore, PageIntro, Tabs, useCursorList } from './shared'

interface AuditEvent {
  id: string
  occurred_at: string
  actor_id: string | null
  action: string
  subject_type: string | null
  subject_id: string | null
  result: string
  reason: string | null
}

interface SecurityEvent {
  id: string
  occurred_at: string
  event_type: string
  severity: 'info' | 'warning' | 'critical'
  identifier: string | null
  ip_address: string | null
}

function Audit() {
  const [action, setAction] = useState('')
  const [debounced, setDebounced] = useState('')
  const list = useCursorList<AuditEvent>('/admin/audit-events', { ...(debounced ? { action: debounced } : {}), per_page: 40 })

  const columns: Column<AuditEvent>[] = [
    { key: 'action', header: 'Action', render: (row) => <code className="rounded bg-[var(--chart-track)] px-1.5 py-0.5 text-xs font-semibold">{row.action}</code> },
    { key: 'subject', header: 'Objet', hideOnMobile: true, render: (row) => (row.subject_type ? `${row.subject_type.split('\\').pop()} · ${row.subject_id?.slice(-6) ?? ''}` : '—') },
    { key: 'result', header: 'Résultat', render: (row) => <StatusBadge label={row.result} tone={row.result === 'success' ? 'success' : 'danger'} /> },
    { key: 'reason', header: 'Motif', hideOnMobile: true, render: (row) => <span className="line-clamp-1 max-w-[260px] text-[var(--color-text-muted)]">{row.reason ?? '—'}</span> },
    { key: 'date', header: 'Date', render: (row) => dateTime(row.occurred_at) },
  ]

  return (
    <Panel
      title="Journal d’audit"
      subtitle="Chaque décision métier, chaînée et infalsifiable."
      flush
      action={
        <form
          onSubmit={(event) => {
            event.preventDefault()
            setDebounced(action.trim())
          }}
        >
          <input value={action} onChange={(event) => setAction(event.target.value)} placeholder="Filtrer par action (ex. payments.approved)" aria-label="Filtrer par action" className={`${FIELD} w-64`} />
        </form>
      }
    >
      {list.error && <ErrorLine message={list.error} />}
      {list.loading && list.rows.length === 0 ? <LoadingBlock /> : <DataTable columns={columns} rows={list.rows} rowKey={(row) => row.id} empty={<EmptyState title="Aucun évènement" description="Aucune entrée ne correspond." />} />}
      <LoadMore hasMore={list.hasMore} loading={list.loading} onClick={list.more} />
    </Panel>
  )
}

function Security() {
  const [severity, setSeverity] = useState('')
  const list = useCursorList<SecurityEvent>('/admin/security-events', { ...(severity ? { severity } : {}), per_page: 40 })
  const columns: Column<SecurityEvent>[] = [
    { key: 'type', header: 'Évènement', render: (row) => <code className="rounded bg-[var(--chart-track)] px-1.5 py-0.5 text-xs font-semibold">{row.event_type}</code> },
    { key: 'severity', header: 'Gravité', render: (row) => <StatusBadge label={row.severity === 'info' ? 'Info' : row.severity === 'warning' ? 'Alerte' : 'Critique'} tone={row.severity === 'info' ? 'info' : row.severity === 'warning' ? 'warning' : 'danger'} /> },
    { key: 'who', header: 'Identifiant', hideOnMobile: true, render: (row) => row.identifier ?? '—' },
    { key: 'ip', header: 'Adresse IP', hideOnMobile: true, render: (row) => <span className="font-mono text-xs">{row.ip_address ?? '—'}</span> },
    { key: 'date', header: 'Date', render: (row) => dateTime(row.occurred_at) },
  ]
  return (
    <Panel
      title="Journal de sécurité"
      subtitle="Connexions, codes à usage unique, privilèges et sessions."
      flush
      action={
        <select aria-label="Gravité" value={severity} onChange={(event) => setSeverity(event.target.value)} className={FIELD}>
          <option value="">Toutes les gravités</option>
          <option value="info">Info</option>
          <option value="warning">Alerte</option>
          <option value="critical">Critique</option>
        </select>
      }
    >
      {list.error && <ErrorLine message={list.error} />}
      {list.loading && list.rows.length === 0 ? <LoadingBlock /> : <DataTable columns={columns} rows={list.rows} rowKey={(row) => row.id} empty={<EmptyState title="Aucun évènement" description="Rien à signaler." />} />}
      <LoadMore hasMore={list.hasMore} loading={list.loading} onClick={list.more} />
    </Panel>
  )
}

export default function JournalPage() {
  const { can } = useAuth()
  const tabs = [...(can('audit.view') ? [{ value: 'audit' as const, label: 'Audit' }] : []), ...(can('security_events.view') ? [{ value: 'security' as const, label: 'Sécurité' }] : [])]
  const [tab, setTab] = useState<'audit' | 'security'>(tabs[0]?.value ?? 'audit')

  return (
    <>
      <Helmet>
        <title>Journaux — CECT Admin</title>
      </Helmet>
      <div className="space-y-6">
        <PageIntro title="Journaux" description="Traçabilité complète des actions de l’équipe et des évènements de sécurité." actions={tabs.length > 1 ? <Tabs value={tab} onChange={setTab} options={tabs} /> : undefined} />
        {tab === 'audit' ? <Audit /> : <Security />}
      </div>
    </>
  )
}
