import type { CameraNode, DetectionPing, FlaggedEntity, Zone } from '@/components/intelligence/godseye/lib'
import { GodsEyeLoader } from '@/components/intelligence/GodsEyeLoader'
import { createClient } from '@/utils/supabase/server'
import { parsePointToLatLng } from '@/lib/coords'

export default async function GodsEyePage() {
  const supabase = await createClient()

  const results = await Promise.allSettled([
    supabase.from('cameras').select('id, name, location, is_online, coordinates'),
    supabase
      .from('detections')
      .select('id, camera_id, feature, class_name, confidence, timestamp, camera_coords, evidence_path')
      .order('timestamp', { ascending: false })
      .limit(150),
    supabase
      .from('known_faces')
      .select('id, name, threat_level, last_seen_at, last_seen_camera_id, detection_count')
      .eq('is_archived', false)
      .order('detection_count', { ascending: false })
      .limit(20),
    supabase
      .from('watchlist_plates')
      .select('id, plate_text, threat_level, last_seen_at, last_seen_camera_id, detection_count')
      .eq('is_archived', false)
      .order('detection_count', { ascending: false })
      .limit(20),
    supabase.from('zones').select('id, name, type, polygon_wkt'),
  ])

  const get = <T,>(i: number, fallback: T): T => {
    const r = results[i]
    if (r.status === 'rejected') {
      console.error('[godseye] query failed:', r.reason)
      return fallback
    }
    const { data, error } = r.value as { data: T | null; error: unknown }
    if (error) console.error('[godseye] query error:', error)
    return (data ?? fallback) as T
  }

  const cams = get<Array<{ id: string; name: string | null; location: string | null; is_online: boolean | null; coordinates: unknown }>>(0, [])
  const dets = get<Array<{ id: string; camera_id: string | null; feature: string; class_name: string | null; confidence: number | null; timestamp: string | null; camera_coords: unknown; evidence_path: string | null }>>(1, [])
  const faces = get<Array<{ id: string; name: string; threat_level: string | null; last_seen_at: string | null; last_seen_camera_id: string | null; detection_count: number | null }>>(2, [])
  const plates = get<Array<{ id: string; plate_text: string; threat_level: string | null; last_seen_at: string | null; last_seen_camera_id: string | null; detection_count: number | null }>>(3, [])
  const zones = get<Array<{ id: string; name: string; type: string; polygon_wkt: string | null }>>(4, [])

  const cameraNameById = new Map((cams ?? []).map((c) => [c.id, c.name]))

  const cameras: CameraNode[] = (cams ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    location: c.location,
    is_online: Boolean(c.is_online),
    coordinates: parsePointToLatLng(c.coordinates),
  }))

  const detections: DetectionPing[] = (dets ?? []).flatMap((d) => {
    const coords = parsePointToLatLng(d.camera_coords) ?? parsePointToLatLng((cams ?? []).find((c) => c.id === d.camera_id)?.coordinates)
    if (!coords) return []
    return [{
      id: d.id,
      camera_id: d.camera_id,
      camera_name: cameraNameById.get(d.camera_id ?? '') ?? null,
      feature: d.feature,
      class_name: d.class_name,
      confidence: d.confidence,
      ts: d.timestamp ?? new Date().toISOString(),
      coords,
      evidence_path: d.evidence_path,
      threat: 'low' as const,
    }]
  })

  const flagged: FlaggedEntity[] = [
    ...(faces ?? []).map((f) => ({
      id: f.id, kind: 'face' as const, label: f.name,
      threat: f.threat_level, last_seen: f.last_seen_at,
      last_camera_id: f.last_seen_camera_id, detection_count: f.detection_count ?? 0,
    })),
    ...(plates ?? []).map((p) => ({
      id: p.id, kind: 'plate' as const, label: p.plate_text,
      threat: p.threat_level, last_seen: p.last_seen_at,
      last_camera_id: p.last_seen_camera_id, detection_count: p.detection_count ?? 0,
    })),
  ]

  const z: Zone[] = (zones ?? []).map((z) => ({
    id: z.id, name: z.name, type: z.type, polygon_wkt: z.polygon_wkt,
  }))

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">God&apos;s Eye View</h2>
        <p className="text-muted-foreground">Live tactical situational awareness across all nodes.</p>
      </div>
      <GodsEyeLoader
        cameras={cameras}
        detections={detections}
        flagged={flagged}
        zones={z}
      />
    </div>
  )
}
