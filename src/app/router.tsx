import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { AdminLayout } from '@/components/layout/AdminLayout'

const StaffLoginPage = lazy(() => import('@/pages/StaffLoginPage'))
const SuperadminLoginPage = lazy(() => import('@/pages/SuperadminLoginPage'))
const SuperadminSecurityPage = lazy(() => import('@/pages/admin/SuperadminSecurityPage'))
const SuperadminGovernancePage = lazy(() => import('@/pages/admin/SuperadminGovernancePage'))
const AdminHomePage = lazy(() => import('@/pages/admin/AdminHomePage'))
const MembresPage = lazy(() => import('@/pages/admin/MembresPage'))
const ValidationsPage = lazy(() => import('@/pages/admin/ValidationsPage'))
const FinancePage = lazy(() => import('@/pages/admin/FinancePage'))
const ConfigurationPage = lazy(() => import('@/pages/admin/ConfigurationPage'))
const ExportPage = lazy(() => import('@/pages/admin/ExportPage'))
const PacksPage = lazy(() => import('@/pages/admin/PacksPage'))
const PaiementsPage = lazy(() => import('@/pages/admin/PaiementsPage'))
const EquipePage = lazy(() => import('@/pages/admin/EquipePage'))
const JournalPage = lazy(() => import('@/pages/admin/JournalPage'))
const CashbackPage = lazy(() => import('@/pages/admin/CashbackPage'))

const IS_SUPERADMIN_HOST = window.location.hostname.toLowerCase().startsWith('superadmin.')
const SUPERADMIN_PATH_MODE = import.meta.env.VITE_SUPERADMIN_PATH_MODE === 'true'
const ALLOW_SUPERADMIN_ENTRY = IS_SUPERADMIN_HOST || SUPERADMIN_PATH_MODE

function Loading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
    </div>
  )
}

function S({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Loading />}>{children}</Suspense>
}

const router = createBrowserRouter([
  { path: '/', element: <Navigate to={IS_SUPERADMIN_HOST ? '/superadmin/connexion' : '/admin'} replace /> },
  { path: '/connexion', element: <Navigate to={IS_SUPERADMIN_HOST ? '/superadmin/connexion' : '/equipe/connexion'} replace /> },
  { path: '/equipe/connexion', element: IS_SUPERADMIN_HOST ? <Navigate to="/superadmin/connexion" replace /> : <S><StaffLoginPage /></S> },
  { path: '/superadmin/connexion', element: ALLOW_SUPERADMIN_ENTRY ? <S><SuperadminLoginPage /></S> : <Navigate to="/connexion" replace /> },
  { path: '/activation', element: <Navigate to="/equipe/connexion" replace /> },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <S><AdminHomePage /></S> },
      { path: 'validations', element: <S><ValidationsPage /></S> },
      { path: 'finance', element: <S><FinancePage /></S> },
      { path: 'paiements', element: <S><PaiementsPage /></S> },
      { path: 'membres', element: <S><MembresPage /></S> },
      { path: 'packs', element: <S><PacksPage /></S> },
      { path: 'cashback', element: <Navigate to="/admin/packs?family=CONSOMMATEUR" replace /> },
      { path: 'pays', element: <S><CashbackPage /></S> },
      { path: 'equipe', element: <S><EquipePage /></S> },
      { path: 'configuration', element: <S><ConfigurationPage /></S> },
      { path: 'securite', element: <S><SuperadminSecurityPage /></S> },
      { path: 'gouvernance', element: <S><SuperadminGovernancePage /></S> },
      { path: 'journal', element: <S><JournalPage /></S> },
      { path: 'export', element: <S><ExportPage /></S> },
    ],
  },
  { path: '*', element: <Navigate to="/admin" replace /> },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
