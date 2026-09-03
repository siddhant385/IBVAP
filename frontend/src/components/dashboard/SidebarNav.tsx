'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Bell, Map, Users, Video, Eye, ChartLine, ShieldAlert, Activity, LogOut, UserCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  match?: (path: string) => boolean
  badgeKey?: 'alerts' | 'threats'
}

type NavGroup = {
  label: string
  items: NavItem[]
}

const groups: NavGroup[] = [
  {
    label: 'Operations',
    items: [
      { href: '/', label: 'Command Center', icon: Map, match: (p) => p === '/' },
      { href: '/alerts', label: 'Investigation', icon: Bell, match: (p) => p.startsWith('/alerts'), badgeKey: 'alerts' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/intelligence/godseye', label: "God's Eye", icon: Eye, match: (p) => p.startsWith('/intelligence/godseye') },
      { href: '/intelligence/faces', label: 'Watchlists', icon: Users, match: (p) => p.startsWith('/intelligence/faces') || p.startsWith('/intelligence/vehicles') },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/infrastructure', label: 'Infrastructure', icon: Video, match: (p) => p.startsWith('/infrastructure') },
      { href: '/analytics', label: 'Analytics', icon: ChartLine, match: (p) => p.startsWith('/analytics') },
    ],
  },
]

const isActive = (item: NavItem, path: string) => (item.match ? item.match(path) : path === item.href || path.startsWith(item.href + '/'))

export function SidebarNav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname()
  const supabase = createClient()
  const [counts, setCounts] = useState<{ alerts: number; threats: number }>({ alerts: 0, threats: 0 })
  const [healthOk, setHealthOk] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const loadCounts = async () => {
      const [{ count: alerts }, { count: threats }] = await Promise.all([
        supabase.from('alerts').select('*', { count: 'exact', head: true })
          .in('status', ['unacknowledged', 'investigating'])
          .in('severity', ['warning', 'critical']),
        supabase.from('alerts').select('*', { count: 'exact', head: true })
          .eq('severity', 'critical')
          .in('status', ['unacknowledged', 'investigating']),
      ])
      setCounts({ alerts: alerts ?? 0, threats: threats ?? 0 })
    }
    loadCounts()
    const channel = supabase
      .channel('sidebar-badges')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => { loadCounts() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  useEffect(() => {
    let cancelled = false
    const ping = async () => {
      try {
        const { data } = await supabase.from('devices').select('*', { count: 'exact', head: true }).eq('is_online', true)
        if (!cancelled) setHealthOk((data?.length ?? 0) >= 0)
      } catch {
        if (!cancelled) setHealthOk(false)
      }
    }
    ping()
    const id = setInterval(ping, 30000)
    return () => { cancelled = true; clearInterval(id) }
  }, [supabase])

  useEffect(() => {
    if (!menuOpen) return
    const onClick = () => setMenuOpen(false)
    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  }, [menuOpen])

  return (
    <aside className="w-64 flex-col border-r border-border/50 bg-sidebar flex h-full">
      <div className="flex h-16 items-center gap-2.5 border-b border-border/50 px-5">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/30 blur-md rounded-full" />
          <ShieldAlert className="h-6 w-6 text-primary relative" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-heading text-base font-bold tracking-[0.2em] text-sidebar-foreground">IBVAP</span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">Tactical</span>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto p-3">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/70">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                const active = isActive(item, pathname)
                const badgeValue = item.badgeKey ? counts[item.badgeKey] : 0
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all',
                      active
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-primary" />
                    )}
                    <Icon className={cn('h-4 w-4 transition-transform', active && 'text-primary')} />
                    <span className="flex-1">{item.label}</span>
                    {badgeValue > 0 && (
                      <span className={cn(
                        'min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full text-[10px] font-bold',
                        item.badgeKey === 'threats'
                          ? 'bg-destructive text-destructive-foreground'
                          : 'bg-primary/15 text-primary'
                      )}>
                        {badgeValue > 99 ? '99+' : badgeValue}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border/50 p-3 space-y-1">
        <div className={cn(
          'flex items-center gap-2 rounded-md px-3 py-2 text-xs',
          healthOk ? 'text-sidebar-foreground' : 'text-destructive'
        )}>
          <Activity className={cn('h-3.5 w-3.5', healthOk ? 'text-green-500' : 'text-destructive')} />
          <span className="flex-1">{healthOk ? 'All systems operational' : 'System degraded'}</span>
          <span className={cn(
            'h-1.5 w-1.5 rounded-full',
            healthOk ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.7)]' : 'bg-destructive'
          )} />
        </div>
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
            className="w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-sidebar-accent/60 transition"
          >
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-xs font-bold">
              {userEmail.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-medium text-sidebar-foreground truncate">{userEmail}</p>
              <p className="text-[10px] text-muted-foreground">Operator</p>
            </div>
          </button>
          {menuOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1 rounded-md border border-border/60 bg-popover shadow-lg py-1 z-50">
              <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-b border-border/40">
                Signed in as <span className="text-foreground">{userEmail}</span>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted text-left"
              >
                <UserCircle2 className="h-3.5 w-3.5" /> Profile
              </button>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted text-left text-destructive"
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign Out
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
