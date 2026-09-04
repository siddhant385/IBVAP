import { parsePointToLatLng } from '@/lib/coords'

export interface CameraNode {
  id: string
  name: string | null
  location: string | null
  is_online: boolean
  coordinates: [number, number] | null
}

export interface DetectionPing {
  id: string
  camera_id: string | null
  camera_name: string | null
  feature: string
  class_name: string | null
  confidence: number | null
  ts: string
  coords: [number, number] | null
  evidence_path: string | null
}

export type ThreatLevel = 'critical' | 'high' | 'medium' | 'low' | 'none'

export interface FlaggedEntity {
  id: string
  kind: 'face' | 'plate'
  label: string
  threat: string | null
  last_seen: string | null
  last_camera_id: string | null
  detection_count: number
}

export interface Zone {
  id: string
  name: string
  type: string
  polygon_wkt: string | null
}

export const THREAT_COLORS: Record<ThreatLevel, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
  none: '#94a3b8',
}

const CRITICAL_CLASSES = ['weapon', 'gun', 'knife', 'fire', 'smoke', 'fight', 'explosion']
const HIGH_CLASSES = ['intrusion', 'loitering', 'crowd', 'vehicle', 'suspicious']

export function deriveThreat(d: Pick<DetectionPing, 'class_name' | 'confidence' | 'feature'>): ThreatLevel {
  const cls = (d.class_name ?? '').toLowerCase()
  const conf = d.confidence ?? 0
  if (CRITICAL_CLASSES.some((c) => cls.includes(c)) && conf > 0.5) return 'critical'
  if (HIGH_CLASSES.some((c) => cls.includes(c)) && conf > 0.6) return 'high'
  if (d.feature === 'face' || d.feature === 'plate') {
    if (conf > 0.85) return 'high'
    if (conf > 0.6) return 'medium'
  }
  if (conf > 0.7) return 'medium'
  return 'low'
}

export const ZONE_COLORS: Record<string, { stroke: string; fill: string }> = {
  restricted: { stroke: '#ef4444', fill: '#ef4444' },
  patrol: { stroke: '#22c55e', fill: '#22c55e' },
  sensitive: { stroke: '#f59e0b', fill: '#f59e0b' },
  default: { stroke: '#3b82f6', fill: '#3b82f6' },
}

export type TimeWindow = '5m' | '15m' | '1h' | '24h'
export const WINDOW_MS: Record<TimeWindow, number> = {
  '5m': 300000,
  '15m': 900000,
  '1h': 3600000,
  '24h': 86400000,
}

export const evidenceUrl = (path: string | null | undefined): string | null => {
  if (!path) return null
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/evidence/${path}`
}

export const parseCoords = parsePointToLatLng

export function parsePolygonWKT(wkt: string | null): [number, number][] | null {
  if (!wkt) return null
  const m = wkt.match(/POLYGON\s*\(\((.*)\)\)/i)
  if (!m) return null
  const pairs = m[1].split(',').map((p) => p.trim().split(/\s+/).map(Number))
  return pairs.filter((p) => p.length === 2 && !isNaN(p[0]) && !isNaN(p[1])) as [number, number][]
}
