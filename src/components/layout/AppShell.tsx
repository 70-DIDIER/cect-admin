import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, LogOut, Menu, Moon, Search, Sun, X, type LucideIcon } from 'lucide-react'
import { Avatar } from '@/components/dashboard/Avatar'
import { CommandPalette, type Command } from '@/components/ui/CommandPalette'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'

export interface NavItem {
  label: string
  icon: LucideIcon
  to: string
  end?: boolean
  badge?: number
  /** Affiché dans la barre d'onglets du mobile. */
  tab?: boolean
  /** Libellé court de l'onglet mobile. */
  tabLabel?: string
}

export interface NavSection {
  title?: string
  items: NavItem[]
}

interface AppShellProps {
  brand: { title: string; subtitle: string }
  sections: NavSection[]
  user: { name: string; roleLabel: string }
  onLogout: () => void
  pageTitle: string
  children: ReactNode
}

const ITEM = 'relative flex min-h-[44px] items-center gap-3 rounded-xl px-3.5 text-[14px] font-semibold transition-colors'

function NavEntry({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const Icon = item.icon
  return (
    <NavLink to={item.to} end={item.end} onClick={onNavigate} className={({ isActive }) => cn(ITEM, isActive ? 'bg-[var(--forest-500)] text-white' : 'text-white/70 hover:bg-[var(--forest-700)] hover:text-white')}>
      {({ isActive }) => (
        <>
          {isActive && <span aria-hidden className="absolute -left-3 top-2.5 h-6 w-[3px] rounded-r-full bg-[var(--lime)]" />}
          <Icon size={18} aria-hidden className={cn('shrink-0', isActive ? 'text-[var(--lime)]' : 'opacity-80')} />
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge !== undefined && item.badge > 0 && (
            <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-[var(--lime)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--forest-900)]">
              {item.badge}
              <span className="sr-only"> à traiter</span>
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

function Sidebar({ brand, sections, user, onLogout, onNavigate }: Omit<AppShellProps, 'children' | 'pageTitle'> & { onNavigate: () => void }) {
  return (
    <div className="flex h-full flex-col bg-[var(--forest-900)] text-white">
      <div className="flex items-center gap-3 px-6 pb-6 pt-7">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white p-1">
          <img src="/logos/CECT_logo_transparent.png" alt="" className="h-full w-full object-contain" />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[15px] font-bold">{brand.title}</p>
          <p className="truncate text-xs text-[var(--sidebar-muted)]">{brand.subtitle}</p>
        </div>
      </div>

      <nav aria-label={brand.title} className="sidebar-scroll flex-1 space-y-7 overflow-y-auto px-3 pb-6 pt-2">
        {sections.map((section, index) => (
          <div key={section.title ?? index}>
            {section.title && <p className="mb-2 px-3.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--sidebar-muted)]">{section.title}</p>}
            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavEntry item={item} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="m-3 rounded-2xl bg-[var(--forest-700)] p-3">
        <div className="flex items-center gap-3">
          <Avatar name={user.name} tone="lime" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-bold">{user.name}</p>
            <p className="truncate text-xs text-[var(--sidebar-muted)]">{user.roleLabel}</p>
          </div>
        </div>
        <button type="button" onClick={onLogout} className="mt-3 flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl border border-white/15 text-sm font-semibold text-white/90 transition-colors hover:bg-[var(--forest-500)]">
          <LogOut size={15} aria-hidden />
          Déconnexion
        </button>
      </div>
    </div>
  )
}

export function AppShell({ children, pageTitle, ...sidebar }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const closeDrawer = () => setDrawerOpen(false)

  useEffect(() => {
    document.documentElement.classList.add('app-forest')
    return () => document.documentElement.classList.remove('app-forest')
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const items = useMemo(() => sidebar.sections.flatMap((section) => section.items), [sidebar.sections])
  const tabs = items.filter((item) => item.tab).slice(0, 4)

  const commands = useMemo<Command[]>(
    () => [
      ...items.map((item) => ({ id: item.to, label: item.label, hint: 'Aller à la page', icon: item.icon, run: () => navigate(item.to) })),
      { id: 'theme', label: theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre', icon: theme === 'dark' ? Sun : Moon, run: toggle },
      { id: 'logout', label: 'Se déconnecter', icon: LogOut, run: sidebar.onLogout },
    ],
    [items, navigate, theme, toggle, sidebar.onLogout]
  )

  return (
    <div className="min-h-screen bg-[var(--dash-bg)] text-[var(--color-text)]">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-[var(--forest-900)] focus:px-4 focus:py-2 focus:text-white">
        Aller au contenu
      </a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] lg:block">
        <Sidebar {...sidebar} onNavigate={() => undefined} />
      </aside>

      <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--forest-900)]/60 lg:hidden" />
          <Dialog.Content aria-describedby={undefined} className="fixed inset-y-0 left-0 z-50 w-[280px] max-w-[86vw] outline-none data-[state=open]:animate-[slide-in_.2s_ease-out] lg:hidden">
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <Dialog.Close className="absolute right-3 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-xl text-white/80 hover:bg-[var(--forest-500)]" aria-label="Fermer le menu">
              <X size={20} aria-hidden />
            </Dialog.Close>
            <Sidebar {...sidebar} onNavigate={closeDrawer} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--dash-bg)] px-4 sm:px-8">
          <button type="button" onClick={() => setDrawerOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--dash-card)] lg:hidden" aria-label="Ouvrir le menu">
            <Menu size={19} aria-hidden />
          </button>
          <p className="hidden min-w-0 flex-1 truncate text-[15px] font-bold text-[var(--color-text)] lg:block">{pageTitle}</p>
          <p className="flex min-w-0 flex-1 items-center gap-2 text-[15px] font-bold text-[var(--color-text)] lg:hidden">
            <img src="/logos/CECT_logo_transparent.png" alt="" className="h-7 w-7 object-contain" />
            CECT
          </p>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="hidden h-10 items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--dash-card)] pl-3.5 pr-2 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)] md:flex md:w-64"
            aria-label="Rechercher ou lancer une action"
          >
            <Search size={15} aria-hidden />
            <span className="flex-1 text-left">Rechercher…</span>
            <kbd className="rounded-md border border-[var(--color-border)] px-1.5 py-0.5 text-[11px] font-semibold">Ctrl K</kbd>
          </button>
          <button type="button" onClick={() => setPaletteOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--dash-card)] text-[var(--color-text-muted)] md:hidden" aria-label="Rechercher ou lancer une action">
            <Search size={17} aria-hidden />
          </button>

          <button
            type="button"
            onClick={toggle}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--dash-card)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
            aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
          >
            {theme === 'dark' ? <Sun size={17} aria-hidden /> : <Moon size={17} aria-hidden />}
          </button>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger className="flex h-10 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--dash-card)] pl-1 pr-2.5 transition-colors hover:bg-[var(--chart-track)]">
              <Avatar name={sidebar.user.name} size="sm" />
              <span className="hidden max-w-[140px] truncate text-sm font-semibold sm:block">{sidebar.user.name}</span>
              <ChevronDown size={15} aria-hidden className="text-[var(--color-text-muted)]" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={8} className="z-50 min-w-[220px] rounded-2xl border border-[var(--color-border)] bg-[var(--dash-card)] p-1.5 shadow-[var(--shadow-pop)]">
                <div className="px-3 py-2">
                  <p className="text-sm font-bold">{sidebar.user.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{sidebar.user.roleLabel}</p>
                </div>
                <DropdownMenu.Separator className="my-1 h-px bg-[var(--color-border)]" />
                <DropdownMenu.Item onSelect={sidebar.onLogout} className="flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[var(--tone-danger-fg)] outline-none data-[highlighted]:bg-[var(--tone-danger-bg)]">
                  <LogOut size={15} aria-hidden /> Déconnexion
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </header>

        <main id="contenu" className="mx-auto w-full max-w-[1200px] px-4 py-8 pb-28 sm:px-8 lg:pb-14">
          {children}
        </main>
      </div>

      {tabs.length > 0 && (
        <nav aria-label="Navigation rapide" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[var(--color-border)] bg-[var(--dash-card)] px-2 pb-[env(safe-area-inset-bottom)] lg:hidden">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = tab.end ? pathname === tab.to : pathname.startsWith(tab.to)
            return (
              <Link key={tab.to} to={tab.to} aria-current={active ? 'page' : undefined} className={cn('flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold', active ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]')}>
                <Icon size={20} aria-hidden />
                {tab.tabLabel ?? tab.label}
              </Link>
            )
          })}
          <button type="button" onClick={() => setDrawerOpen(true)} className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-[var(--color-text-muted)]">
            <Menu size={20} aria-hidden />
            Plus
          </button>
        </nav>
      )}

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} commands={commands} />
    </div>
  )
}
