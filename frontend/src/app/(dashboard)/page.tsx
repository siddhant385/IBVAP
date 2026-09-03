import { createClient } from '@/utils/supabase/server'
import { RealtimeAlertFeed } from '@/app/(dashboard)/alerts/_components/RealtimeAlertFeed'
import { RealtimeKpiRibbon } from '@/components/dashboard/RealtimeKpiRibbon'
import { DynamicCommandMap } from '@/components/dashboard/DynamicCommandMap'
import { DetectionAlertTrendChart } from '@/components/dashboard/DetectionAlertTrendChart'
import { WatchlistMatchFeed } from '@/components/dashboard/WatchlistMatchFeed'

export default async function CommandCenterPage() {
  const supabase = await createClient()

  // Fetch quick stats & initial datasets concurrently
  const todayStart = new Date(new Date().setHours(0,0,0,0)).toISOString()

  const [
    { count: totalDevices },
    { count: onlineDevices },
    { count: todayAlerts },
    { count: activeThreats },
    { count: activeCameras },
    { count: faceMatches },
    { count: plateMatches },
    { data: cameraMarkers },
    { data: recentDetections },
    { data: recentAlerts },
    { data: recentFaceResults },
    { data: recentAnprResults }
  ] = await Promise.all([
    supabase.from('devices').select('*', { count: 'exact', head: true }),
    supabase.from('devices').select('*', { count: 'exact', head: true }).eq('is_online', true),
    supabase.from('alerts').select('*', { count: 'exact', head: true }).gte('timestamp', todayStart),
    supabase.from('alerts').select('*', { count: 'exact', head: true })
      .in('status', ['unacknowledged', 'investigating'])
      .in('severity', ['warning', 'critical']),
    supabase.from('cameras').select('*', { count: 'exact', head: true }).eq('is_online', true),
    supabase.from('face_results').select('*', { count: 'exact', head: true }).not('matched_identity_id', 'is', null),
    supabase.from('anpr_results').select('*', { count: 'exact', head: true }).eq('is_flagged', true),
    supabase.from('cameras').select('id, name, location, is_online, coordinates'),
    supabase.from('detections').select('timestamp').gte('timestamp', todayStart),
    supabase.from('alerts').select('timestamp').gte('timestamp', todayStart),
    supabase.from('face_results').select('id, similarity_score, created_at, matched_identity_id').not('matched_identity_id', 'is', null).order('created_at', { ascending: false }).limit(5),
    supabase.from('anpr_results').select('id, plate_text, plate_confidence, created_at, is_flagged').eq('is_flagged', true).order('created_at', { ascending: false }).limit(5)
  ])

  const totalWatchlistMatches = (faceMatches || 0) + (plateMatches || 0)

  // Map hourly trend data for chart
  const hourlyDataMap = new Map<string, { hour: string; detections: number; alerts: number }>()
  for (let i = 0; i < 24; i += 4) {
    const label = `${i.toString().padStart(2, '0')}:00`
    hourlyDataMap.set(label, { hour: label, detections: 0, alerts: 0 })
  }

  if (recentDetections) {
    recentDetections.forEach((d: { timestamp: string }) => {
      const hour = new Date(d.timestamp).getHours()
      const bucket = `${(Math.floor(hour / 4) * 4).toString().padStart(2, '0')}:00`
      if (hourlyDataMap.has(bucket)) {
        hourlyDataMap.get(bucket)!.detections += 1
      }
    })
  }

  if (recentAlerts) {
    recentAlerts.forEach((a: { timestamp: string }) => {
      const hour = new Date(a.timestamp).getHours()
      const bucket = `${(Math.floor(hour / 4) * 4).toString().padStart(2, '0')}:00`
      if (hourlyDataMap.has(bucket)) {
        hourlyDataMap.get(bucket)!.alerts += 1
      }
    })
  }

  const trendChartData = Array.from(hourlyDataMap.values())

  // Initial watchlist feed items
  const initialMatches = [
    ...(recentFaceResults || []).map((f) => ({
      id: f.id,
      type: 'face' as const,
      title: 'Identity Match Detected',
      subtitle: `Similarity: ${((f.similarity_score || 0) * 100).toFixed(1)}%`,
      timestamp: new Date(f.created_at).toLocaleTimeString()
    })),
    ...(recentAnprResults || []).map((a) => ({
      id: a.id,
      type: 'anpr' as const,
      title: `Flagged Plate: ${a.plate_text || 'UNKNOWN'}`,
      subtitle: `Confidence: ${((a.plate_confidence || 0) * 100).toFixed(1)}%`,
      timestamp: new Date(a.created_at).toLocaleTimeString()
    }))
  ].slice(0, 5)

  const parseCoord = (val: unknown): [number, number] | null => {
    if (!val) return null
    if (Array.isArray(val) && val.length === 2) {
      const a = Number(val[0]); const b = Number(val[1])
      return isNaN(a) || isNaN(b) ? null : [a, b]
    }
    if (typeof val === 'string') {
      const m = val.trim().match(/^\(?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)?$/)
      if (m) return [Number(m[1]), Number(m[2])]
      try {
        const p = JSON.parse(val)
        if (Array.isArray(p) && p.length === 2) return [Number(p[0]), Number(p[1])]
      } catch { /* ignore */ }
    }
    return null
  }

  const parsedCameraMarkers = (cameraMarkers || []).map((cam) => ({
    ...cam,
    coordinates: parseCoord(cam.coordinates)
  }))

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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4 min-h-[450px]">
          <DynamicCommandMap initialCameras={parsedCameraMarkers} />
        </div>
        
        <div className="col-span-3">
          <RealtimeAlertFeed />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4 min-h-[300px]">
          <DetectionAlertTrendChart data={trendChartData} />
        </div>
        <div className="col-span-3 min-h-[300px]">
          <WatchlistMatchFeed initialMatches={initialMatches} />
        </div>
      </div>
    </div>
  )
}
