import { createClient } from '@/utils/supabase/server'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertsKpiRibbon } from './_components/AlertsKpiRibbon'
import { RealtimeAlertFeed } from './_components/RealtimeAlertFeed'
import { AlertsFilterBar } from './_components/AlertsFilterBar'
import { AlertsTable } from './_components/AlertsTable'
import { NodeAlertsDistributionTable } from './_components/NodeAlertsDistributionTable'
import { Activity, ShieldAlert, Table as TableIcon, Cpu } from 'lucide-react'

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const params = await searchParams

  const severity = params.severity as string
  const status = params.status as string
  const deviceId = params.device as string
  const dateRange = params.date as string
  const objectClass = params.class as string

  // Query alerts for historical table
  let query = supabase
    .from('alerts')
    .select(`
      *,
      devices ( name, location ),
      cameras ( name ),
      face_results ( id ),
      anpr_results ( id, is_flagged ),
      detections ( class_name )
    `)
    .order('timestamp', { ascending: false })
    .limit(100)

  if (severity && severity !== 'all') query = query.eq('severity', severity)
  if (status && status !== 'all') query = query.eq('status', status)
  if (deviceId && deviceId !== 'all') query = query.eq('device_id', deviceId)
  if (objectClass && objectClass !== 'all') query = query.eq('detections.class_name', objectClass)

  const now = new Date()
  if (dateRange === 'today') {
    now.setHours(0,0,0,0)
    query = query.gte('timestamp', now.toISOString())
  } else if (dateRange === 'week') {
    now.setDate(now.getDate() - 7)
    query = query.gte('timestamp', now.toISOString())
  }

  const { data: alerts, error } = await query
  const { data: devices } = await supabase.from('devices').select('id, name').order('name')

  if (error) console.error('Error fetching alerts:', error)

  // Calculate Metrics for KPI Ribbon
  const startOfDay = new Date()
  startOfDay.setHours(0,0,0,0)
  
  const { count: totalToday } = await supabase
    .from('alerts')
    .select('*', { count: 'exact', head: true })
    .gte('timestamp', startOfDay.toISOString())

  const { count: unacknowledged } = await supabase
    .from('alerts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'unacknowledged')

  const { count: criticalCount } = await supabase
    .from('alerts')
    .select('*', { count: 'exact', head: true })
    .eq('severity', 'critical')
    .eq('status', 'unacknowledged')

  const { count: resolvedToday } = await supabase
    .from('alerts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'resolved')
    .gte('resolved_at', startOfDay.toISOString())

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Alert Command Center</h2>
        <p className="text-muted-foreground text-sm">
          Monitor real-time security events, triage critical threats, and analyze historical incident logs.
        </p>
      </div>

      {/* High Level KPI Metrics */}
      <AlertsKpiRibbon 
        totalToday={totalToday || 0}
        unacknowledged={unacknowledged || 0}
        criticalCount={criticalCount || 0}
        resolvedToday={resolvedToday || 0}
      />

      {/* Main Content View Switcher */}
      <Tabs defaultValue="live-feed" className="w-full space-y-4">
        <TabsList className="bg-muted/50 p-1 border border-border/50">
          <TabsTrigger value="live-feed" className="gap-2">
            <ShieldAlert className="size-4" /> Live Stream & Triage
          </TabsTrigger>
          <TabsTrigger value="node-distribution" className="gap-2">
            <Cpu className="size-4" /> Edge Node Distribution
          </TabsTrigger>
          <TabsTrigger value="historical" className="gap-2">
            <TableIcon className="size-4" /> Historical Log Search
          </TabsTrigger>
        </TabsList>

        <TabsContent value="live-feed" className="space-y-4 mt-0">
          <RealtimeAlertFeed />
        </TabsContent>

        <TabsContent value="node-distribution" className="space-y-4 mt-0">
          <NodeAlertsDistributionTable />
        </TabsContent>

        <TabsContent value="historical" className="space-y-4 mt-0">
          <AlertsFilterBar devices={devices || []} currentParams={params as Record<string, string>} />
          <AlertsTable alerts={alerts || []} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
