import dynamic from 'next/dynamic'
import { Card } from '@/components/ui/card'
import type { CameraNode, DetectionPing, FlaggedEntity, Zone } from '@/components/intelligence/GodsEyeClient'
import { createClient } from '@/utils/supabase/server'

const GodsEyeClient = dynamic(
  () => import('@/components/intelligence/GodsEyeClient').then((m) => m.GodsEyeClient),
  {
    ssr: false,
    loading: () => (
      <Card className="h-[calc(100vh-180px)] flex items-center justify-center text-muted-foreground text-sm animate-pulse">
        Initializing God&apos;s Eye...
      </Card>
    ),
  }
)

const parsePoint = (val: unknown): [number, number] | null => {
  if (!val) return null
  if (typeof val === 'string') {
    try {
      const p = JSON.parse(val)
      if (Array.isArray(p) && p.length === 2) return [Number(p[0]), Number(p[1])]
    } catch { /* ignore */ }
    return null
  }
  if (Array.isArray(val) && val.length === 2) return [Number(val[0]), Number(val[1])]
  return null
}

export default async function GodsEyePage() {
  const supabase = await createClient()

  const [{ data: cams }, { data: dets }, { data: faces }, { data: plates }, { data: zones }] = await Promise.all([
    supabase.from('cameras').select('id, name, location, is_online, coordinates'),
    supabase
      .from('detections')
      .select('id, camera_id, feature, class_name, confidence, timestamp, camera_coords')
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

  const cameraNameById = new Map((cams ?? []).map((c) => [c.id, c.name]))

  const cameras: CameraNode[] = (cams ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    location: c.location,
    is_online: Boolean(c.is_online),
    coordinates: parsePoint(c.coordinates),
  }))

  const detections: DetectionPing[] = (dets ?? []).flatMap((d) => {
    const coords = parsePoint(d.camera_coords) ?? parsePoint((cams ?? []).find((c) => c.id === d.camera_id)?.coordinates)
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
      <GodsEyeClient
        initialCameras={cameras}
        initialDetections={detections}
        initialFlagged={flagged}
        initialZones={z}
      />
    </div>
  )
}
