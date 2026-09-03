'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Bell, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const titles: Array<[RegExp, string]> = [
  [/^\/$/, 'Command Center'],
  [/^\/alerts\/[^/]+$/, 'Alert Detail'],
  [/^\/alerts/, 'Investigation'],
  [/^\/intelligence\/godseye/, "God's Eye View"],
  [/^\/intelligence\/vehicles/, 'ANPR Watchlist'],
  [/^\/intelligence\/faces/, 'Known Faces'],
  [/^\/intelligence/, 'Intelligence'],
  [/^\/infrastructure\/[^/]+/, 'Camera Settings'],
  [/^\/infrastructure/, 'Infrastructure'],
  [/^\/analytics/, 'Analytics'],
]

export function DashboardHeader({ email }: { email: string }) {
  const pathname = usePathname()
  const [alerts, setAlerts] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { count } = await supabase
        .from('alerts')
        .select('*', { count: 'exact', head: true })
        .in('status', ['unacknowledged', 'investigating'])
        .in('severity', ['warning', 'critical'])
      setAlerts(count ?? 0)
    }
    load()
    const ch = supabase.channel('header-badges')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [supabase])

  const title = titles.find(([re]) => re.test(pathname))?.[1] ?? 'IBVAP'

  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-border/50 bg-background/80 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex flex-col leading-tight min-w-0">
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">IBVAP</span>
          <h1 className="font-heading text-lg font-semibold tracking-tight truncate">{title}</h1>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search cameras, faces, plates..."
            className="pl-8 h-9 bg-muted/40 border-border/50 text-sm"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Alerts">
          <Bell className="h-4 w-4" />
          {alerts > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
              {alerts > 99 ? '99+' : alerts}
            </span>
          )}
        </Button>
        <span className="hidden md:inline text-xs text-muted-foreground">{email}</span>
      </div>
    </header>
  )
}
