import { headers } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { RealtimeAlertFeed } from '@/app/(dashboard)/alerts/_components/RealtimeAlertFeed'
import { RealtimeKpiRibbon } from '@/components/dashboard/RealtimeKpiRibbon'
import { DynamicCommandMap } from '@/components/dashboard/DynamicCommandMap'
import { DetectionAlertTrendChart, type HourlyTrendData } from '@/components/dashboard/DetectionAlertTrendChart'
import { WatchlistMatchFeed } from '@/components/dashboard/WatchlistMatchFeed'
import { AnalyticsPanel, type AnalyticsData, type CameraActivity, type ThreatBucket } from '@/components/dashboard/AnalyticsPanel'
import { parsePointToLatLng } from '@/lib/coords'

const WINDOW_HOURS = 24
const BUCKET_COUNT = 24
const BUCKET_MS = (WINDOW_HOURS * 60 * 60 * 1000) / BUCKET_COUNT

export const dynamic = 'force-dynamic'

export default async function CommandCenterPage() {
  const supabase = await createClient()
  // Force dynamic rendering so Date.now() per request is allowed
  await headers()

  // Server component: this runs once per request on the server, not in render
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  const windowStart = new Date(now - WINDOW_HOURS * 60 * 60 * 1000).toISOString()
  const dayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()

  const [
    { count: totalDevices },
    { count: onlineDevices },
    { count: todayAlerts },
    { count: activeThreats },
    { count: activeCameras },
    { count: faceMatches },
    { count: plateMatches },
    { data: cameraMarkers },
    { data: windowedDetections },
    { data: windowedAlerts },
    { data: recentFaceResults },
    { data: recentAnprResults },
    { data: recentAlertsResolved },
    { data: recentAlertsCreated }
  ] = await Promise.all([
    supabase.from('devices').select('*', { count: 'exact', head: true }),
    supabase.from('devices').select('*', { count: 'exact', head: true }).eq('is_online', true),
    supabase.from('alerts').select('*', { count: 'exact', head: true }).gte('timestamp', dayStart),
    supabase.from('alerts').select('*', { count: 'exact', head: true })
      .in('status', ['unacknowledged', 'investigating'])
      .in('severity', ['warning', 'critical']),
    supabase.from('cameras').select('*', { count: 'exact', head: true }).eq('is_online', true),
    supabase.from('face_results').select('*', { count: 'exact', head: true }).not('matched_identity_id', 'is', null),
    supabase.from('anpr_results').select('*', { count: 'exact', head: true }).eq('is_flagged', true),
    supabase.from('cameras').select('id, name, location, is_online, coordinates'),
    supabase.from('detections').select('id, camera_id, feature, timestamp').gte('timestamp', windowStart),
    supabase.from('alerts').select('id, camera_id, severity, status, timestamp').gte('timestamp', windowStart),
    supabase.from('face_results').select('id, similarity_score, created_at, matched_identity_id').not('matched_identity_id', 'is', null).order('created_at', { ascending: false }).limit(5),
    supabase.from('anpr_results').select('id, plate_text, plate_confidence, created_at, is_flagged').eq('is_flagged', true).order('created_at', { ascending: false }).limit(5),
    supabase.from('alerts').select('id, status, acknowledged_at, timestamp').not('acknowledged_at', 'is', null).gte('timestamp', windowStart),
    supabase.from('alerts').select('id, severity, timestamp, status').gte('timestamp', windowStart),
  ])

  // Build 24 hourly buckets anchored to `now`, rolling backward
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

  // Analytics: top cameras by detection count
  const camDetectionCount = new Map<string, number>()
  const camAlertCount = new Map<string, number>()
  for (const d of windowedDetections ?? []) {
    if (!d.camera_id) continue
    camDetectionCount.set(d.camera_id, (camDetectionCount.get(d.camera_id) ?? 0) + 1)
  }
  for (const a of windowedAlerts ?? []) {
    if (!a.camera_id) continue
    camAlertCount.set(a.camera_id, (camAlertCount.get(a.camera_id) ?? 0) + 1)
  }
  const camNameById = new Map((cameraMarkers ?? []).map((c) => [c.id, c.name ?? 'Camera']))
  const camOnlineById = new Map((cameraMarkers ?? []).map((c) => [c.id, Boolean(c.is_online)]))
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

  // Threat distribution
  const threatCounts: Record<string, number> = { critical: 0, warning: 0, info: 0 }
  for (const a of recentAlertsCreated ?? []) {
    const s = (a.severity ?? 'info').toLowerCase()
    threatCounts[s] = (threatCounts[s] ?? 0) + 1
  }
  const threatMix: ThreatBucket[] = [
    { level: 'critical', count: threatCounts.critical, color: '#ef4444' },
    { level: 'warning', count: threatCounts.warning, color: '#f59e0b' },
    { level: 'info', count: threatCounts.info, color: '#3b82f6' },
  ].filter((b) => b.count > 0)

  // Feature mix
  const featureCounts: Record<string, number> = {}
  for (const d of windowedDetections ?? []) {
    featureCounts[d.feature] = (featureCounts[d.feature] ?? 0) + 1
  }
  const featureMix = Object.entries(featureCounts)
    .map(([feature, count]) => ({ feature, count }))
    .sort((a, b) => b.count - a.count)

  // Response time avg
  const responseTimes: number[] = []
  for (const a of recentAlertsResolved ?? []) {
    if (a.acknowledged_at && a.timestamp) {
      const diff = (new Date(a.acknowledged_at).getTime() - new Date(a.timestamp).getTime()) / 60000
      if (diff >= 0 && diff < 24 * 60) responseTimes.push(diff)
    }
  }
  const avgResponseMin = responseTimes.length > 0 ? responseTimes.reduce((s, x) => s + x, 0) / responseTimes.length : null
  const resolvedCount = (recentAlertsCreated ?? []).filter((a) => a.status === 'resolved' || a.status === 'false_positive').length
  const totalAlerts = (recentAlertsCreated ?? []).length

  const analytics: AnalyticsData = {
    topCameras,
    threatMix,
    featureMix,
    avgResponseMin,
    resolvedCount,
    totalAlerts,
  }

  const totalWatchlistMatches = (faceMatches || 0) + (plateMatches || 0)

  // Initial watchlist feed items — use ISO strings to avoid hydration mismatch
  const initialMatches = [
    ...(recentFaceResults || []).map((f) => ({
      id: f.id,
      type: 'face' as const,
      title: 'Identity Match Detected',
      subtitle: `Similarity: ${((f.similarity_score || 0) * 100).toFixed(1)}%`,
      timestamp: f.created_at,
    })),
    ...(recentAnprResults || []).map((a) => ({
      id: a.id,
      type: 'anpr' as const,
      title: `Flagged Plate: ${a.plate_text || 'UNKNOWN'}`,
      subtitle: `Confidence: ${((a.plate_confidence || 0) * 100).toFixed(1)}%`,
      timestamp: a.created_at,
    })),
  ].slice(0, 5)

  const parsedCameraMarkers = (cameraMarkers || [])
    .map((cam) => ({ ...cam, coordinates: parsePointToLatLng(cam.coordinates) }))
    .filter((c): c is typeof c & { coordinates: [number, number] } => c.coordinates !== null)

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Live Command Center</h2>
          <p className="text-muted-foreground">
            Real-time situational awareness across all deployed edge nodes.
          </p>
        </div>
      </div>

      <RealtimeKpiRibbon 
        initialTotalDevices={totalDevices || 0}
        initialOnlineDevices={onlineDevices || 0}
        initialTodayAlerts={todayAlerts || 0}
        initialActiveThreats={activeThreats || 0}
        initialActiveCameras={activeCameras || 0}
        initialWatchlistMatches={totalWatchlistMatches}
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7 items-stretch">
        <div className="col-span-4 h-[500px]">
          <DynamicCommandMap initialCameras={parsedCameraMarkers} />
        </div>
        
        <div className="col-span-3 h-[500px]">
          <RealtimeAlertFeed />
        </div>
      </div>

      <DetectionAlertTrendChart initialData={buckets} initialWindow="24h" />

      <AnalyticsPanel initial={analytics} windowHours={WINDOW_HOURS} />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4 min-h-[300px]">
          <WatchlistMatchFeed initialMatches={initialMatches} />
        </div>
        <div className="col-span-3 min-h-[300px]">
          <RealtimeAlertFeed />
        </div>
      </div>
    </div>
  )
}
