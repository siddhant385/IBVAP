import { createClient } from '@/utils/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { DetectionAlertTrendChart, type HourlyTrendData } from '@/components/dashboard/DetectionAlertTrendChart'
import { AnalyticsPanel, type AnalyticsData, type CameraActivity, type ThreatBucket } from '@/components/dashboard/AnalyticsPanel'
import { Activity, ShieldAlert, Cpu } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const supabase = await createClient()

  const WINDOW_HOURS = 24 * 7 // 7 Days Historical Analytics
  const now = Date.now()
  const windowStart = new Date(now - WINDOW_HOURS * 60 * 60 * 1000).toISOString()

  const [
    { data: windowedDetections },
    { data: windowedAlerts },
    { data: cameras },
  ] = await Promise.all([
    supabase.from('detections').select('id, camera_id, feature, timestamp').gte('timestamp', windowStart),
    supabase.from('alerts').select('id, camera_id, severity, status, timestamp, acknowledged_at').gte('timestamp', windowStart),
    supabase.from('cameras').select('id, name, is_online'),
  ])

  // Hourly trend buckets for past 7 days
  const BUCKET_COUNT = 24
  const BUCKET_MS = (WINDOW_HOURS * 60 * 60 * 1000) / BUCKET_COUNT
  const buckets: HourlyTrendData[] = []
  const lastBucketStart = Math.floor(now / BUCKET_MS) * BUCKET_MS

  for (let i = BUCKET_COUNT - 1; i >= 0; i--) {
    const start = lastBucketStart - i * BUCKET_MS
    buckets.push({
      ts: new Date(start).toISOString(),
      label: '',
      detections: 0,
      alerts: 0,
    })
  }

  const findBucket = (ts: string) => {
    const t = new Date(ts).getTime()
    const idx = Math.floor((t - (lastBucketStart - (BUCKET_COUNT - 1) * BUCKET_MS)) / BUCKET_MS)
    return idx >= 0 && idx < BUCKET_COUNT ? idx : -1
  }

  for (const d of windowedDetections ?? []) {
    const i = findBucket(d.timestamp ?? '')
    if (i >= 0) buckets[i].detections += 1
  }
  for (const a of windowedAlerts ?? []) {
    const i = findBucket(a.timestamp ?? '')
    if (i >= 0) buckets[i].alerts += 1
  }

  // Camera Activity
  const camDetectionCount = new Map<string, number>()
  const camAlertCount = new Map<string, number>()
  for (const d of windowedDetections ?? []) {
    if (d.camera_id) camDetectionCount.set(d.camera_id, (camDetectionCount.get(d.camera_id) ?? 0) + 1)
  }
  for (const a of windowedAlerts ?? []) {
    if (a.camera_id) camAlertCount.set(a.camera_id, (camAlertCount.get(a.camera_id) ?? 0) + 1)
  }

  const camNameById = new Map((cameras ?? []).map((c) => [c.id, c.name ?? 'Camera']))
  const camOnlineById = new Map((cameras ?? []).map((c) => [c.id, Boolean(c.is_online)]))

  const topCameras: CameraActivity[] = Array.from(camDetectionCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([id, count]) => ({
      id,
      name: camNameById.get(id) ?? 'Camera',
      detections: count,
      alerts: camAlertCount.get(id) ?? 0,
      online: camOnlineById.get(id) ?? false,
    }))

  // Threat Mix
  const threatCounts: Record<string, number> = { critical: 0, warning: 0, info: 0 }
  for (const a of windowedAlerts ?? []) {
    const s = (a.severity ?? 'info').toLowerCase()
    threatCounts[s] = (threatCounts[s] ?? 0) + 1
  }
  const threatMix: ThreatBucket[] = [
    { level: 'critical', count: threatCounts.critical, color: '#ef4444' },
    { level: 'warning', count: threatCounts.warning, color: '#f59e0b' },
    { level: 'info', count: threatCounts.info, color: '#3b82f6' },
  ].filter((b) => b.count > 0)

  // Feature Mix
  const featureCounts: Record<string, number> = {}
  for (const d of windowedDetections ?? []) {
    featureCounts[d.feature] = (featureCounts[d.feature] ?? 0) + 1
  }
  const featureMix = Object.entries(featureCounts)
    .map(([feature, count]) => ({ feature, count }))
    .sort((a, b) => b.count - a.count)

  const responseTimes: number[] = []
  for (const a of windowedAlerts ?? []) {
    if (a.acknowledged_at && a.timestamp) {
      const diff = (new Date(a.acknowledged_at).getTime() - new Date(a.timestamp).getTime()) / 60000
      if (diff >= 0 && diff < 24 * 60) responseTimes.push(diff)
    }
  }

  const avgResponseMin = responseTimes.length > 0 ? responseTimes.reduce((s, x) => s + x, 0) / responseTimes.length : null
  const resolvedCount = (windowedAlerts ?? []).filter((a) => a.status === 'resolved' || a.status === 'false_positive').length
  const totalAlerts = (windowedAlerts ?? []).length

  const analytics: AnalyticsData = {
    topCameras,
    threatMix,
    featureMix,
    avgResponseMin,
    resolvedCount,
    totalAlerts,
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Analytics & System Performance</h2>
        <p className="text-muted-foreground">
          7-day historical telemetry, threat distribution, and camera node activity.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/50">
          <CardHeader className="py-4">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Activity className="size-4 text-primary" /> Total Detections (7d)
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="text-2xl font-bold font-mono">{windowedDetections?.length || 0}</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="py-4">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="size-4 text-destructive" /> Total Security Alerts (7d)
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="text-2xl font-bold font-mono text-destructive">{totalAlerts}</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="py-4">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Cpu className="size-4 text-blue-500" /> Active Camera Nodes
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="text-2xl font-bold font-mono">{cameras?.filter(c => c.is_online).length || 0} / {cameras?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      <DetectionAlertTrendChart initialData={buckets} initialWindow="7d" />

      <AnalyticsPanel initial={analytics} windowHours={WINDOW_HOURS} />
    </div>
  )
}
