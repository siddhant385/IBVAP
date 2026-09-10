import { headers } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { RealtimeAlertFeed } from '@/app/(dashboard)/alerts/_components/RealtimeAlertFeed'
import { RealtimeKpiRibbon } from '@/components/dashboard/RealtimeKpiRibbon'
import { DynamicCommandMap } from '@/components/dashboard/DynamicCommandMap'
import { DetectionAlertTrendChart, type HourlyTrendData } from '@/components/dashboard/DetectionAlertTrendChart'
import { WatchlistMatchFeed } from '@/components/dashboard/WatchlistMatchFeed'
import { parsePointToLatLng } from '@/lib/coords'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Cpu } from 'lucide-react'

const WINDOW_HOURS = 24
const BUCKET_COUNT = 24
const BUCKET_MS = (WINDOW_HOURS * 60 * 60 * 1000) / BUCKET_COUNT

export const dynamic = 'force-dynamic'

export default async function CommandCenterPage() {
  const supabase = await createClient()
  await headers()

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
    { data: recentAnprResults }
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
    supabase.from('anpr_results').select('id, plate_text, plate_confidence, created_at, is_flagged').eq('is_flagged', true).order('created_at', { ascending: false }).limit(5)
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

  const totalWatchlistMatches = (faceMatches || 0) + (plateMatches || 0)

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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4 min-h-[300px]">
          <WatchlistMatchFeed initialMatches={initialMatches} />
        </div>
        <div className="col-span-3 min-h-[300px]">
          <Card className="h-full border-border/50">
            <CardHeader className="bg-muted/30 border-b border-border/50 py-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Cpu className="size-4 text-primary" /> Active Camera Nodes Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {(cameraMarkers || []).slice(0, 5).map((cam) => (
                <div key={cam.id} className="flex items-center justify-between p-2 rounded-md bg-muted/20 border border-border/40 text-xs">
                  <div>
                    <p className="font-semibold text-foreground">{cam.name || 'Unnamed Camera'}</p>
                    <p className="text-muted-foreground">{cam.location || 'Unassigned Location'}</p>
                  </div>
                  <Badge variant={cam.is_online ? 'default' : 'secondary'} className={cam.is_online ? 'bg-green-600' : ''}>
                    {cam.is_online ? 'ONLINE' : 'OFFLINE'}
                  </Badge>
                </div>
              ))}
              {!cameraMarkers?.length && (
                <p className="text-xs text-muted-foreground text-center py-4">No camera nodes registered.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
