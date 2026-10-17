import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { AdminLayout } from '@/components/layout/AdminLayout'

const LoginPage = lazy(() => import('@/pages/LoginPage'))
const SuperadminLoginPage = lazy(() => import('@/pages/SuperadminLoginPage'))
const SuperadminSecurityPage = lazy(() => import('@/pages/admin/SuperadminSecurityPage'))
const ActivationPage = lazy(() => import('@/pages/ActivationPage'))
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
  { path: '/', element: <Navigate to="/admin" replace /> },
  { path: '/connexion', element: <S><LoginPage /></S> },
  { path: '/superadmin/connexion', element: <S><SuperadminLoginPage /></S> },
  { path: '/activation', element: <S><ActivationPage /></S> },
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
      { path: 'cashback', element: <S><CashbackPage /></S> },
      { path: 'equipe', element: <S><EquipePage /></S> },
      { path: 'configuration', element: <S><ConfigurationPage /></S> },
      { path: 'securite', element: <S><SuperadminSecurityPage /></S> },
      { path: 'journal', element: <S><JournalPage /></S> },
      { path: 'export', element: <S><ExportPage /></S> },
    ],
  },
  { path: '*', element: <Navigate to="/admin" replace /> },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
