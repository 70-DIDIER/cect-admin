import { useMemo } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BadgePercent, CircleCheck, CreditCard, Download, Landmark, LayoutDashboard, Package, ScrollText, Settings, Users, UserCog } from 'lucide-react'
import { useAuth } from '@/app/AuthContext'
import { fetchAdminDashboard } from '@/data/adminDashboard'
import { isAdminRole, type UserRole } from '@/lib/roles'
import { FullPageLoader } from './FullPageLoader'
import { AppShell, type NavItem, type NavSection } from './AppShell'

const ROLE_LABELS: Record<UserRole, string> = {
  administrateur: 'Administrateur',
  superadmin: 'Super-administrateur',
  validateur: 'Validateur',
  comptabilite: 'Comptabilité',
  utilisateur: 'Membre',
}

interface AdminNavItem extends NavItem {
  section: string
  permissions: string[]
}

const NAV: AdminNavItem[] = [
  { section: 'Pilotage', to: '/admin', label: 'Tableau de bord', icon: LayoutDashboard, end: true, permissions: [], tab: true, tabLabel: 'Accueil' },
  { section: 'Opérations', to: '/admin/validations', label: 'Validations', icon: CircleCheck, permissions: ['payments.validate_manual', 'yem_validations.view'], tab: true },
  { section: 'Opérations', to: '/admin/finance', label: 'Finance', icon: Landmark, permissions: ['reports.view', 'payouts.view'], tab: true },
  { section: 'Opérations', to: '/admin/paiements', label: 'Paiements', icon: CreditCard, permissions: ['payments.view'] },
  { section: 'Gestion', to: '/admin/membres', label: 'Membres', icon: Users, permissions: ['members.view'], tab: true },
  { section: 'Gestion', to: '/admin/packs', label: 'Packs', icon: Package, permissions: ['packs.view'] },
  { section: 'Gestion', to: '/admin/cashback', label: 'Cashback & pays', icon: BadgePercent, permissions: ['settings.view'] },
  { section: 'Gestion', to: '/admin/equipe', label: 'Équipe & rôles', icon: UserCog, permissions: ['staff.view', 'roles.view'] },
  { section: 'Système', to: '/admin/configuration', label: 'Configuration', icon: Settings, permissions: ['settings.view'] },
  { section: 'Système', to: '/admin/securite', label: 'Sécurité SuperAdmin', icon: Settings, permissions: ['settings.update_critical'] },
  { section: 'Système', to: '/admin/journal', label: 'Journaux', icon: ScrollText, permissions: ['audit.view', 'security_events.view'] },
  { section: 'Système', to: '/admin/export', label: 'Exports', icon: Download, permissions: ['reports.export', 'reports.view'] },
]

export function AdminLayout() {
  const { user, loading, logout, can } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const role = user?.role

  const canValidate = can('payments.validate_manual') || can('yem_validations.view')
  const { data } = useQuery({
    queryKey: ['admin-dashboard', 30],
    queryFn: () => fetchAdminDashboard(30),
    enabled: canValidate,
  })
  const pendingCount = data ? data.pending_validations.payments + data.pending_validations.yem + data.pending_validations.merchant : 0

  const sections = useMemo<NavSection[]>(() => {
    if (!role) return []
    const visible = NAV.filter((item) => (item.to !== '/admin/securite' || role === 'superadmin') && (item.permissions.length === 0 || item.permissions.some(can)))
    const titles = [...new Set(visible.map((item) => item.section))]
    return titles.map((title) => ({
      title,
      items: visible
        .filter((item) => item.section === title)
        .map(({ section: _section, permissions: _permissions, ...item }) => (item.to === '/admin/validations' ? { ...item, badge: pendingCount } : item)),
    }))
  }, [role, pendingCount, can])

  if (loading) return <FullPageLoader />
  if (!user || !isAdminRole(user.role)) return <Navigate to="/connexion" replace state={{ from: location.pathname }} />

  const current = NAV.filter((item) => (item.end ? location.pathname === item.to : location.pathname.startsWith(item.to))).sort((a, b) => b.to.length - a.to.length)[0]

  async function handleLogout() {
    await logout()
    navigate('/connexion')
  }

  return (
    <AppShell
      brand={{ title: 'CECT Admin', subtitle: 'Coopérative CECT Togo' }}
      sections={sections}
      user={{ name: user.name, roleLabel: ROLE_LABELS[user.role] }}
      onLogout={() => void handleLogout()}
      pageTitle={current?.label ?? 'Administration'}
    >
      <Outlet />
    </AppShell>
  )
}
