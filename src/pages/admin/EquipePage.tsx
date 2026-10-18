import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Pencil, Plus, ShieldCheck, UserCheck, UserX } from 'lucide-react'
import { useAuth } from '@/app/AuthContext'
import { Avatar } from '@/components/dashboard/Avatar'
import { Panel } from '@/components/dashboard/Panel'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { CheckListDialog } from '@/components/ui/CheckListDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { FormDialog } from '@/components/ui/FormDialog'
import { get, getRaw, newIdempotencyKey, post, put } from '@/lib/api'
import { dateTime, ErrorLine, GhostButton, LoadingBlock, PageIntro, PrimaryButton, Tabs } from './shared'

interface StaffMember {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  status: string
  last_login_at: string | null
  roles: string[]
}

interface Role {
  id: number
  name: string
  label: string | null
  is_system: boolean
  permissions: string[]
  users_count: number
}

interface PermissionsPayload {
  permissions: { name: string; description: string; reserved_to_superadmin: boolean }[]
  incompatible_pairs: [string, string][]
}

function statusBadge(status: string) {
  if (status === 'active') return <StatusBadge label="Actif" tone="success" />
  if (status === 'suspended') return <StatusBadge label="Suspendu" tone="danger" />
  if (status === 'pending_activation') return <StatusBadge label="Activation en attente" tone="warning" />
  return <StatusBadge label={status} tone="neutral" />
}

function Staff({ roles }: { roles: Role[] }) {
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<StaffMember | null>(null)
  const [editingHours, setEditingHours] = useState<StaffMember | null>(null)
  const [toggling, setToggling] = useState<StaffMember | null>(null)
  const query = useQuery({ queryKey: ['staff'], queryFn: () => getRaw<{ data: StaffMember[] }>('/admin/staff', { per_page: 100 }), staleTime: 0 })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['staff'] })
  const manage = can('staff.manage')
  const scheduleManager = manage && can('settings.update_critical')
  const label = (name: string) => roles.find((role) => role.name === name)?.label ?? name
  const assignableRoles = roles.filter((role) => role.name !== 'superadmin' && role.name !== 'validateur')

  return (
    <>
      <Panel
        title="Comptes internes"
        subtitle="Les personnes qui administrent la plateforme."
        flush
        action={
          manage && (
            <PrimaryButton onClick={() => setCreating(true)}>
              <Plus size={16} aria-hidden /> Nouveau compte
            </PrimaryButton>
          )
        }
      >
        {query.isPending && <LoadingBlock />}
        {query.isError && <ErrorLine message="Impossible de charger l’équipe." />}
        {query.isSuccess && query.data.data.length === 0 && <EmptyState title="Aucun compte interne" description="Créez le premier compte de l’équipe." />}
        <ul className="divide-y divide-[var(--color-border)]">
          {query.data?.data.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 sm:px-6">
              <Avatar name={`${member.first_name} ${member.last_name}`} />
              <div className="min-w-0 flex-1 basis-56">
                <p className="truncate text-sm font-bold">
                  {member.first_name} {member.last_name}
                </p>
                <p className="truncate text-xs text-[var(--color-text-muted)]">{member.email}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {member.roles.map((role) => (
                  <StatusBadge key={role} label={label(role)} tone="info" />
                ))}
              </div>
              <div className="flex items-center gap-3">
                {statusBadge(member.status)}
                <span className="hidden text-xs text-[var(--color-text-muted)] lg:block">Dernière connexion : {dateTime(member.last_login_at)}</span>
              </div>
              {manage && (
                <div className="flex gap-2">
                  <GhostButton onClick={() => setEditing(member)} aria-label={`Modifier les rôles de ${member.first_name}`}>
                    <Pencil size={14} aria-hidden /> Rôles
                  </GhostButton>
                  {scheduleManager && member.roles.every(role => role !== 'superadmin') && (
                    <GhostButton onClick={() => setEditingHours(member)}>
                      <KeyRound size={14} aria-hidden /> Horaires
                    </GhostButton>
                  )}
                  <GhostButton onClick={() => setToggling(member)} aria-label={member.status === 'suspended' ? 'Réactiver' : 'Suspendre'}>
                    {member.status === 'suspended' ? <UserCheck size={14} aria-hidden /> : <UserX size={14} aria-hidden />}
                    {member.status === 'suspended' ? 'Réactiver' : 'Suspendre'}
                  </GhostButton>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      {creating && <CreateStaff roles={assignableRoles} onClose={() => setCreating(false)} onDone={refresh} />}
      {editingHours && <StaffHoursDialog member={editingHours} onClose={() => setEditingHours(null)}/>}
      {editing && (
        <CheckListDialog
          title="Rôles du compte"
          subtitle={`${editing.first_name} ${editing.last_name}`}
          items={assignableRoles.map((role) => ({ value: role.name, label: role.label ?? role.name, hint: `${role.permissions.includes('*') ? 'Tous les droits' : `${role.permissions.length} droit(s)`}` }))}
          initial={editing.roles}
          submitLabel="Enregistrer les rôles"
          onClose={() => setEditing(null)}
          onSubmit={async (selected, reason) => {
            await put(`/admin/staff/${editing.id}/roles`, { roles: selected, reason })
            await refresh()
          }}
        />
      )}
      {toggling && (
        <FormDialog
          title={toggling.status === 'suspended' ? 'Réactiver le compte' : 'Suspendre le compte'}
          subtitle={`${toggling.first_name} ${toggling.last_name}`}
          submitLabel={toggling.status === 'suspended' ? 'Réactiver' : 'Suspendre'}
          danger={toggling.status !== 'suspended'}
          fields={[{ name: 'reason', label: 'Motif (5 caractères minimum)', type: 'textarea', required: true }]}
          onClose={() => setToggling(null)}
          onSubmit={async (values) => {
            await post(`/admin/staff/${toggling.id}/${toggling.status === 'suspended' ? 'reactivate' : 'suspend'}`, { reason: values.reason })
            await refresh()
          }}
        />
      )}
    </>
  )
}

function StaffHoursDialog({ member, onClose }: { member: StaffMember; onClose: () => void }) {
  const query = useQuery({
    queryKey: ['staff-hours', member.id],
    queryFn: () => get<{ enabled: boolean; weekdays: number[]; start_time: string; end_time: string; timezone: string }>(`/admin/staff/${member.id}/login-hours`),
  })
  if (query.isPending) return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"><LoadingBlock/></div>
  if (query.isError) return (
    <div role="alert" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-8">
      <div className="rounded-2xl bg-[var(--dash-card)] p-6"><ErrorLine message="Impossible de charger les horaires du collaborateur."/>
        <button onClick={onClose} className="mt-4 underline">Fermer</button>
      </div>
    </div>
  )
  return <FormDialog
    title={`Horaires autorisés · ${member.first_name} ${member.last_name}`}
    subtitle="Heures locales du Togo (Africa/Lome). Les connexions et opérations hors plage sont bloquées côté serveur. Aucun horaire n'est appliqué lorsque la restriction est désactivée."
    submitLabel="Enregistrer les horaires" onClose={onClose}
    fields={[
      { name: 'enabled', label: 'Restreindre les heures de connexion', type: 'select',
        initial: query.data.enabled ? 'yes' : 'no', options: [
          { value: 'no', label: 'Non · accès à toute heure' },
          { value: 'yes', label: 'Oui · respecter les horaires définis' },
        ] },
      { name: 'days', label: 'Jours autorisés', showWhen: { name: 'enabled', value: 'yes' }, required: true,
        initial: query.data.weekdays.join(','), hint: '1 = lundi, 2 = mardi, …, 7 = dimanche. Exemple : 1,2,3,4,5.' },
      { name: 'start_time', label: 'Heure de début (HH:MM)', showWhen: { name: 'enabled', value: 'yes' },
        initial: query.data.start_time, required: true },
      { name: 'end_time', label: 'Heure de fin (HH:MM)', showWhen: { name: 'enabled', value: 'yes' },
        initial: query.data.end_time, required: true },
      { name: 'reason', label: 'Motif obligatoire', type: 'textarea', required: true },
    ]}
    onSubmit={async values => {
      const weekdays = values.days.split(',').map(x => Number(x.trim()))
      if (!weekdays.length || weekdays.some(d => !Number.isInteger(d) || d < 1 || d > 7) || new Set(weekdays).size !== weekdays.length) {
        throw new Error('Jours invalides. Utilisez une liste comme 1,2,3,4,5.')
      }
      await put(`/admin/staff/${member.id}/login-hours`, {
        enabled: values.enabled === 'yes', weekdays,
        start_time: values.start_time, end_time: values.end_time, reason: values.reason,
      }, newIdempotencyKey())
    }}
  />
}

function CreateStaff({ roles, onClose, onDone }: { roles: Role[]; onClose: () => void; onDone: () => Promise<unknown> }) {
  const [key] = useState(newIdempotencyKey)
  return (
    <FormDialog
      title="Nouveau compte interne"
      subtitle="Le compte Administrateur ou Comptabilité est opérationnel dès sa création. Pour se connecter, l’employé renseigne son e-mail sur /equipe/connexion ; le code sera envoyé aux trois adresses de sécurité du SuperAdmin."
      submitLabel="Créer le compte"
      fields={[
        { name: 'first_name', label: 'Prénom', required: true },
        { name: 'last_name', label: 'Nom', required: true },
        { name: 'email', label: 'Adresse e-mail', required: true },
        { name: 'role', label: 'Rôle', type: 'select', options: roles.map((role) => ({ value: role.name, label: role.label ?? role.name })) },
      ]}
      onClose={onClose}
      onSubmit={async (values) => {
        await post('/admin/staff', { first_name: values.first_name, last_name: values.last_name, email: values.email, roles: [values.role] }, key)
        await onDone()
      }}
    />
  )
}

function Roles({ roles, catalog }: { roles: Role[]; catalog: PermissionsPayload | undefined }) {
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Role | null>(null)

  const items =
    catalog?.permissions.map((permission) => ({
      value: permission.name,
      label: permission.name,
      hint: permission.description,
      group: permission.name.split('.')[0],
      disabled: permission.reserved_to_superadmin,
    })) ?? []

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {roles.map((role) => {
          const all = role.permissions.includes('*')
          return (
            <Panel
              key={role.id}
              title={role.label ?? role.name}
              subtitle={`${role.users_count} utilisateur(s) · ${all ? 'tous les droits' : `${role.permissions.length} droit(s)`}`}
              action={role.is_system ? <StatusBadge label="Système" tone="neutral" icon={ShieldCheck} /> : undefined}
            >
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                {all ? (
                  <StatusBadge label="Accès complet" tone="warning" icon={KeyRound} />
                ) : (
                  role.permissions.map((permission) => (
                    <code key={permission} className="rounded bg-[var(--chart-track)] px-1.5 py-0.5 text-[11px]">
                      {permission}
                    </code>
                  ))
                )}
              </div>
              {can('roles.manage') && !all && (
                <div className="mt-4">
                  <GhostButton onClick={() => setEditing(role)}>
                    <Pencil size={14} aria-hidden /> Modifier les droits
                  </GhostButton>
                </div>
              )}
            </Panel>
          )
        })}
      </div>
      {catalog && catalog.incompatible_pairs.length > 0 && (
        <p className="text-xs text-[var(--color-text-muted)]">Séparation des tâches : certains droits ne peuvent pas être cumulés dans un même rôle ({catalog.incompatible_pairs.map((pair) => pair.join(' ↔ ')).join(' ; ')}).</p>
      )}
      {editing && (
        <CheckListDialog
          title="Droits du rôle"
          subtitle={editing.label ?? editing.name}
          items={items}
          initial={editing.permissions}
          submitLabel="Enregistrer les droits"
          onClose={() => setEditing(null)}
          onSubmit={async (selected, reason) => {
            await put(`/admin/roles/${editing.id}/permissions`, { permissions: selected, reason })
            await queryClient.invalidateQueries({ queryKey: ['roles'] })
          }}
        />
      )}
    </>
  )
}

export default function EquipePage() {
  const { can } = useAuth()
  const tabs = [...(can('staff.view') ? [{ value: 'staff' as const, label: 'Équipe' }] : []), ...(can('roles.view') ? [{ value: 'roles' as const, label: 'Rôles & droits' }] : [])]
  const [tab, setTab] = useState<'staff' | 'roles'>(tabs[0]?.value ?? 'roles')
  const roles = useQuery({ queryKey: ['roles'], queryFn: () => get<Role[]>('/admin/roles'), enabled: can('roles.view') || can('staff.manage'), staleTime: 0 })
  const catalog = useQuery({ queryKey: ['permissions'], queryFn: () => get<PermissionsPayload>('/admin/permissions'), enabled: can('roles.view') })

  return (
    <>
      <Helmet>
        <title>Équipe & rôles — CECT Admin</title>
      </Helmet>
      <div className="space-y-6">
        <PageIntro title="Équipe & rôles" description="Comptes internes, rôles et droits d’accès. Toute modification est motivée, confirmée par code et tracée dans le journal d’audit." actions={tabs.length > 1 ? <Tabs value={tab} onChange={setTab} options={tabs} /> : undefined} />
        {roles.isError && <ErrorLine message="Impossible de charger les rôles." />}
        {tab === 'staff' ? <Staff roles={roles.data ?? []} /> : <Roles roles={roles.data ?? []} catalog={catalog.data} />}
      </div>
    </>
  )
}
