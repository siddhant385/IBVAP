'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, ShieldCheck, Users, AlertTriangle } from 'lucide-react'

export function RealtimeKpiRibbon({
  initialTotalDevices,
  initialOnlineDevices,
  initialTodayAlerts,
  initialActiveCameras,
  initialWatchlistMatches,
  initialActiveThreats
}: {
  initialTotalDevices: number
  initialOnlineDevices: number
  initialTodayAlerts: number
  initialActiveCameras: number
  initialWatchlistMatches: number
  initialActiveThreats: number
}) {
  const [supabase] = useState(() => createClient())

  const [totalDevices, setTotalDevices] = useState(initialTotalDevices)
  const [onlineDevices, setOnlineDevices] = useState(initialOnlineDevices)
  const [todayAlerts, setTodayAlerts] = useState(initialTodayAlerts)
  const [activeCameras, setActiveCameras] = useState(initialActiveCameras)
  const [watchlistMatches, setWatchlistMatches] = useState(initialWatchlistMatches)
  const [activeThreats, setActiveThreats] = useState(initialActiveThreats)

  useEffect(() => {
    // We subscribe to all relevant tables to keep KPIs in sync

    // 1. Devices subscription
    const devicesChannel = supabase.channel('kpi:devices')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, async () => {
        // Since counting is complex with just payloads, refetching exact counts is safer and fast enough for a dashboard
        const { count: total } = await supabase.from('devices').select('*', { count: 'exact', head: true })
        const { count: online } = await supabase.from('devices').select('*', { count: 'exact', head: true }).eq('is_online', true)
        if (total !== null) setTotalDevices(total)
        if (online !== null) setOnlineDevices(online)
      })
      .subscribe()

    // 2. Alerts subscription
    const alertsChannel = supabase.channel('kpi:alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, async () => {
        const todayStart = new Date(new Date().setHours(0,0,0,0)).toISOString()
        const { count: alertsToday } = await supabase.from('alerts').select('*', { count: 'exact', head: true }).gte('timestamp', todayStart)

        // Active threats = unacknowledged or investigating criticals/warnings
        const { count: threats } = await supabase.from('alerts')
          .select('*', { count: 'exact', head: true })
          .in('status', ['unacknowledged', 'investigating'])
          .in('severity', ['warning', 'critical'])

        if (alertsToday !== null) setTodayAlerts(alertsToday)
        if (threats !== null) setActiveThreats(threats)
      })
      .subscribe()

    // 3. Cameras subscription
    const camerasChannel = supabase.channel('kpi:cameras')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cameras' }, async () => {
        const { count: activeCam } = await supabase.from('cameras').select('*', { count: 'exact', head: true }).eq('is_online', true)
        if (activeCam !== null) setActiveCameras(activeCam)
      })
      .subscribe()

    // 4. Matches (Face / ANPR) - separate channel for face + plate
    const faceMatchChannel = supabase.channel('kpi:face-matches')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'face_results' }, () => {
        setWatchlistMatches(prev => prev + 1)
      })
      .subscribe()

    const anprMatchChannel = supabase.channel('kpi:anpr-matches')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'anpr_results' }, (payload) => {
        if (payload.new.is_flagged) {
          setWatchlistMatches(prev => prev + 1)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(devicesChannel)
      supabase.removeChannel(alertsChannel)
      supabase.removeChannel(camerasChannel)
      supabase.removeChannel(faceMatchChannel)
      supabase.removeChannel(anprMatchChannel)
    }
  }, [supabase])

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Threats</CardTitle>
          <AlertTriangle className={`h-4 w-4 ${activeThreats > 0 ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`} />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activeThreats}</div>
          <p className="text-xs text-muted-foreground">Unresolved critical events</p>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Network Health</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-500">{onlineDevices} <span className="text-muted-foreground text-sm font-normal">/ {totalDevices} nodes</span></div>
          <p className="text-xs text-muted-foreground">{activeCameras} cameras online</p>
        </CardContent>
      </Card>
      
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Daily Alerts</CardTitle>
          <ShieldCheck className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{todayAlerts}</div>
          <p className="text-xs text-muted-foreground">Total alerts today</p>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Watchlist Matches</CardTitle>
          <Users className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{watchlistMatches}</div>
          <p className="text-xs text-muted-foreground">Faces & Plates flagged</p>
        </CardContent>
      </Card>
    </div>
  )
}
