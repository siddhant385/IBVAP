'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { AlertCircle, AlertTriangle, CheckCircle2, Bell } from 'lucide-react'

interface KpiProps {
  totalToday: number
  unacknowledged: number
  criticalCount: number
  resolvedToday: number
}

export function AlertsKpiRibbon({
  totalToday: initialTotal,
  unacknowledged: initialUnack,
  criticalCount: initialCritical,
  resolvedToday: initialResolved,
}: KpiProps) {
  const [totalToday, setTotalToday] = useState(initialTotal)
  const [unacknowledged, setUnacknowledged] = useState(initialUnack)
  const [criticalCount, setCriticalCount] = useState(initialCritical)
  const [resolvedToday, setResolvedToday] = useState(initialResolved)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('public:alerts:kpis')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts' },
        (payload) => {
          setTotalToday((prev) => prev + 1)
          if (payload.new.status === 'unacknowledged') {
            setUnacknowledged((prev) => prev + 1)
          }
          if (payload.new.severity === 'critical' && payload.new.status === 'unacknowledged') {
            setCriticalCount((prev) => prev + 1)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'alerts' },
        (payload) => {
          if (payload.new.status === 'resolved') {
            setResolvedToday((prev) => prev + 1)
            setUnacknowledged((prev) => Math.max(0, prev - 1))
            if (payload.new.severity === 'critical') {
              setCriticalCount((prev) => Math.max(0, prev - 1))
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="border-border/50">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Today's Alerts</p>
            <p className="text-2xl font-bold">{totalToday}</p>
          </div>
          <div className="rounded-full bg-muted p-2.5 text-muted-foreground">
            <Bell className="size-5" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Unacknowledged</p>
            <p className="text-2xl font-bold text-orange-500">{unacknowledged}</p>
          </div>
          <div className="rounded-full bg-orange-500/10 p-2.5 text-orange-500">
            <AlertTriangle className="size-5" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Critical Threats</p>
            <p className="text-2xl font-bold text-destructive">{criticalCount}</p>
          </div>
          <div className="rounded-full bg-destructive/10 p-2.5 text-destructive">
            <AlertCircle className="size-5" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Resolved Today</p>
            <p className="text-2xl font-bold text-green-500">{resolvedToday}</p>
          </div>
          <div className="rounded-full bg-green-500/10 p-2.5 text-green-500">
            <CheckCircle2 className="size-5" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
