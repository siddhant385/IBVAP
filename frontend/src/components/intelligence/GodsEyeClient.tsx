'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/utils/supabase/client'
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, Polygon, useMap } from 'react-leaflet'
import { useTheme } from 'next-themes'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Crosshair, Eye, Filter, Pause, Play, RefreshCw, ScanSearch, ShieldAlert, UserCircle2, CarFront, X, MapPin, Activity } from 'lucide-react'

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
  threat: 'critical' | 'high' | 'medium' | 'low' | 'none'
}

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

const CRITICAL_CLASSES = ['weapon', 'gun', 'knife', 'fire', 'smoke', 'fight', 'explosion']
const HIGH_CLASSES = ['intrusion', 'loitering', 'crowd', 'vehicle', 'suspicious']

function deriveThreat(d: DetectionPing): DetectionPing['threat'] {
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

const THREAT_COLORS: Record<DetectionPing['threat'], string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
  none: '#94a3b8',
}

const ZONE_COLORS: Record<string, { stroke: string; fill: string }> = {
  restricted: { stroke: '#ef4444', fill: '#ef4444' },
  patrol: { stroke: '#22c55e', fill: '#22c55e' },
  sensitive: { stroke: '#f59e0b', fill: '#f59e0b' },
  default: { stroke: '#3b82f6', fill: '#3b82f6' },
}

const cameraIcon = (online: boolean) =>
  L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${online ? '#22c55e' : '#64748b'};box-shadow:0 0 0 2px white, 0 0 0 3px ${online ? '#22c55e' : '#64748b'}99;"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })

const detectionIcon = (threat: DetectionPing['threat']) => {
  const color = THREAT_COLORS[threat]
  const size = threat === 'critical' ? 22 : threat === 'high' ? 20 : 18
  const ring = threat === 'critical' ? 'animation:pulse 1.2s infinite;' : 'animation:pulse 1.8s infinite;'
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:${size}px;height:${size}px;">
      <div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:0.35;${ring}"></div>
      <div style="position:absolute;top:${size/2-4}px;left:${size/2-4}px;width:8px;height:8px;border-radius:50%;background:${color};border:2px solid white;"></div>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
  })
}

function parseCoords(value: unknown): [number, number] | null {
  if (!value) return null
  if (Array.isArray(value) && value.length === 2) {
    const a = Number(value[0])
    const b = Number(value[1])
    if (!isNaN(a) && !isNaN(b)) return [a, b]
    return null
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    const paren = trimmed.match(/^\(?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)?$/)
    if (paren) return [Number(paren[1]), Number(paren[2])]
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed) && parsed.length === 2) return [Number(parsed[0]), Number(parsed[1])]
    } catch { /* ignore */ }
  }
  if (typeof value === 'object' && value !== null && 'x' in value && 'y' in value) {
    return [Number((value as { x: number }).x), Number((value as { y: number }).y)]
  }
  return null
}

function parsePolygonWKT(wkt: string | null): [number, number][] | null {
  if (!wkt) return null
  const m = wkt.match(/POLYGON\s*\(\((.*)\)\)/i)
  if (!m) return null
  const pairs = m[1].split(',').map((p) => p.trim().split(/\s+/).map(Number))
  return pairs.filter((p) => p.length === 2 && !isNaN(p[0]) && !isNaN(p[1])) as [number, number][]
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    const bounds = L.latLngBounds(points.map((p) => L.latLng(p[0], p[1])))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
  }, [map, points])
  return null
}

interface Props {
  cameras: CameraNode[]
  detections: DetectionPing[]
  flagged: FlaggedEntity[]
  zones: Zone[]
}

const threatWeight = (t: string | null) => {
  const v = (t ?? '').toLowerCase()
  if (v === 'critical') return 4
  if (v === 'high') return 3
  if (v === 'medium') return 2
  if (v === 'low') return 1
  return 0
}

type TimeWindow = '5m' | '15m' | '1h' | '24h'
const WINDOW_MS: Record<TimeWindow, number> = { '5m': 300000, '15m': 900000, '1h': 3600000, '24h': 86400000 }

export function GodsEyeClient({ cameras: initialCameras, detections: initialDetections, flagged: initialFlagged, zones: initialZones }: Props) {
  const [cameras] = useState<CameraNode[]>(initialCameras)
  const [detections, setDetections] = useState<DetectionPing[]>(initialDetections)
  const [flagged] = useState<FlaggedEntity[]>(initialFlagged)
  const [zones] = useState<Zone[]>(initialZones)
  const [playing, setPlaying] = useState(true)
  const [search, setSearch] = useState('')
  const [featureFilter, setFeatureFilter] = useState<'all' | 'face' | 'plate' | 'object'>('all')
  const [threatFilter, setThreatFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all')
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null)
  const [selectedDetection, setSelectedDetection] = useState<DetectionPing | null>(null)
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('15m')
  const [now, setNow] = useState<number>(() => Date.now())
  const { resolvedTheme } = useTheme()
  const supabase = createClient()

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!playing) return
    const channel = supabase
      .channel('godseye-stream')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'detections' }, async (payload) => {
        const d = payload.new as { id: string; camera_id: string | null; feature: string; class_name: string | null; confidence: number | null; timestamp: string; camera_coords: [number, number] | string | null; evidence_path: string | null }
        const coords = parseCoords(d.camera_coords)
        if (!coords) return
        const { data: cam } = await supabase.from('cameras').select('name').eq('id', d.camera_id).single()
        const ping: DetectionPing = {
          id: d.id,
          camera_id: d.camera_id,
          camera_name: cam?.name ?? null,
          feature: d.feature,
          class_name: d.class_name,
          confidence: d.confidence,
          ts: d.timestamp,
          coords,
          evidence_path: d.evidence_path,
          threat: 'low',
        }
        const enriched = { ...ping, threat: deriveThreat(ping) }
        setDetections((prev) => [enriched, ...prev].slice(0, 500))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [playing, supabase])

  const enrichedDetections = useMemo(
    () => detections.map((d) => ({ ...d, threat: deriveThreat(d) })),
    [detections]
  )

  const windowedDetections = useMemo(() => {
    const cutoff = now - WINDOW_MS[timeWindow]
    return enrichedDetections.filter((d) => new Date(d.ts).getTime() >= cutoff)
  }, [enrichedDetections, timeWindow, now])

  const visibleDetections = useMemo(() => {
    return windowedDetections.filter((d) => {
      if (featureFilter !== 'all' && d.feature !== featureFilter) return false
      if (threatFilter !== 'all' && d.threat !== threatFilter) return false
      if (selectedCameraId && d.camera_id !== selectedCameraId) return false
      if (search && !`${d.camera_name ?? ''} ${d.class_name ?? ''}`.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [windowedDetections, featureFilter, threatFilter, selectedCameraId, search])

  const cameraCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const d of windowedDetections) {
      if (!d.camera_id) continue
      map.set(d.camera_id, (map.get(d.camera_id) ?? 0) + 1)
    }
    return map
  }, [windowedDetections])

  const allPoints = useMemo(
    () => cameras.map((c) => c.coordinates).filter((c): c is [number, number] => !!c),
    [cameras]
  )

  const center: [number, number] = allPoints[0] ?? [28.6139, 77.2090]

  const trailByEntity = useMemo(() => {
    const map = new Map<string, [number, number][]>()
    for (const d of visibleDetections) {
      if (!d.coords) continue
      const key = d.camera_id ?? 'unknown'
      const arr = map.get(key) ?? []
      arr.push([d.coords[0], d.coords[1]])
      if (arr.length > 50) arr.shift()
      map.set(key, arr)
    }
    return map
  }, [visibleDetections])

  const topFlagged = useMemo(() => {
    return [...flagged].sort((a, b) => threatWeight(b.threat) - threatWeight(a.threat)).slice(0, 8)
  }, [flagged])

  const evidenceUrl = (path: string | null) => {
    if (!path) return null
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/evidence/${path}`
  }

  const totalCount = windowedDetections.length
  const criticalCount = windowedDetections.filter((d) => d.threat === 'critical').length

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 h-[calc(100vh-180px)]">
      <Card className="flex flex-col overflow-hidden">
        <CardHeader className="pb-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                God&apos;s Eye View
                {criticalCount > 0 && (
                  <Badge variant="destructive" className="ml-1 animate-pulse">
                    {criticalCount} critical
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>{totalCount} events in last {timeWindow}</CardDescription>
            </div>
            <div className="flex items-center gap-1">
              {(Object.keys(WINDOW_MS) as TimeWindow[]).map((w) => (
                <Button
                  key={w}
                  size="sm"
                  variant={timeWindow === w ? 'default' : 'ghost'}
                  onClick={() => setTimeWindow(w)}
                  className="h-7 px-2 text-xs"
                >
                  {w}
                </Button>
              ))}
              <div className="w-px h-5 bg-border mx-1" />
              <Button size="sm" variant="outline" onClick={() => setPlaying((p) => !p)}>
                {playing ? <><Pause className="h-3.5 w-3.5 mr-1" /> Pause</> : <><Play className="h-3.5 w-3.5 mr-1" /> Resume</>}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDetections([])}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Clear
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0 relative">
          <MapContainer center={center} zoom={12} className="h-full w-full">
            <TileLayer
              key={resolvedTheme}
              className={resolvedTheme === 'dark' ? 'invert brightness-90 contrast-125 hue-rotate-180' : ''}
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {allPoints.length > 0 && <FitBounds points={allPoints} />}
            {zones.map((z) => {
              const ring = parsePolygonWKT(z.polygon_wkt)
              if (!ring || ring.length < 3) return null
              const colors = ZONE_COLORS[z.type] ?? ZONE_COLORS.default
              return (
                <Polygon
                  key={z.id}
                  positions={ring}
                  pathOptions={{
                    color: colors.stroke,
                    fillColor: colors.fill,
                    weight: 2,
                    fillOpacity: 0.12,
                    dashArray: '4 4',
                  }}
                >
                  <Popup>
                    <div className="text-xs space-y-0.5">
                      <p className="font-bold">{z.name}</p>
                      <Badge variant="outline" className="text-[10px]">{z.type}</Badge>
                    </div>
                  </Popup>
                </Polygon>
              )
            })}
            {cameras.map((cam) => {
              if (!cam.coordinates) return null
              const count = cameraCounts.get(cam.id) ?? 0
              return (
                <Marker
                  key={cam.id}
                  position={[cam.coordinates[0], cam.coordinates[1]]}
                  icon={cameraIcon(cam.is_online)}
                  eventHandlers={{ click: () => setSelectedCameraId(cam.id) }}
                >
                  <Popup>
                    <div className="text-xs">
                      <p className="font-bold">{cam.name || 'Camera'}</p>
                      <p className="text-muted-foreground">{cam.location || '—'}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge variant={cam.is_online ? 'default' : 'secondary'}>
                          {cam.is_online ? 'ONLINE' : 'OFFLINE'}
                        </Badge>
                        {count > 0 && (
                          <Badge variant="outline" className="text-[10px]">
                            <Activity className="h-2.5 w-2.5 mr-0.5" /> {count} in window
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )
            })}
            {visibleDetections.map((d) =>
              d.coords ? (
                <Marker
                  key={d.id}
                  position={[d.coords[0], d.coords[1]]}
                  icon={detectionIcon(d.threat)}
                  eventHandlers={{ click: () => setSelectedDetection(d) }}
                >
                  <Popup>
                    <div className="text-xs space-y-0.5">
                      <p className="font-bold capitalize">{d.feature}{d.class_name ? `: ${d.class_name}` : ''}</p>
                      <Badge variant={d.threat === 'critical' ? 'destructive' : 'secondary'} className="text-[10px]">
                        {d.threat.toUpperCase()}
                      </Badge>
                      <p className="text-muted-foreground">{d.camera_name ?? '—'}</p>
                      {d.confidence != null && <p>Confidence: {(d.confidence * 100).toFixed(1)}%</p>}
                      <p>{new Date(d.ts).toLocaleString()}</p>
                    </div>
                  </Popup>
                </Marker>
              ) : null
            )}
            {Array.from(trailByEntity.entries()).map(([camId, pts]) => (
              pts.length > 1 ? (
                <Polyline
                  key={camId}
                  positions={pts}
                  pathOptions={{ color: '#a78bfa', weight: 2, opacity: 0.6 }}
                />
              ) : null
            ))}
            {selectedCameraId && (() => {
              const c = cameras.find((x) => x.id === selectedCameraId)
              if (!c?.coordinates) return null
              return <Circle center={[c.coordinates[0], c.coordinates[1]]} radius={120} pathOptions={{ color: '#22c55e', weight: 1, fillOpacity: 0.1 }} />
            })()}
          </MapContainer>

          {/* Legend overlay */}
          <div className="absolute bottom-3 left-3 z-[400] bg-background/85 backdrop-blur border border-border/60 rounded-md p-2.5 text-[10px] space-y-1 shadow-lg">
            <p className="font-semibold text-foreground mb-1.5">Threat Levels</p>
            {(['critical', 'high', 'medium', 'low'] as const).map((t) => (
              <div key={t} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: THREAT_COLORS[t] }} />
                <span className="capitalize text-muted-foreground">{t}</span>
              </div>
            ))}
            <div className="border-t border-border/40 pt-1 mt-1.5 space-y-1">
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" /><span className="text-muted-foreground">Online</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-500" /><span className="text-muted-foreground">Offline</span></div>
            </div>
          </div>

          {/* Detection detail panel */}
          {selectedDetection && (
            <div className="absolute top-3 right-3 z-[400] w-72 bg-background/95 backdrop-blur border border-border/60 rounded-md shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b border-border/40">
                <div>
                  <p className="text-sm font-semibold capitalize">{selectedDetection.feature}{selectedDetection.class_name ? `: ${selectedDetection.class_name}` : ''}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(selectedDetection.ts).toLocaleString()}</p>
                </div>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setSelectedDetection(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="p-3 space-y-2.5">
                {evidenceUrl(selectedDetection.evidence_path) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={evidenceUrl(selectedDetection.evidence_path)!}
                    alt="evidence"
                    className="w-full rounded border border-border/40 bg-muted"
                  />
                ) : (
                  <div className="w-full h-32 rounded border border-dashed border-border/60 flex items-center justify-center text-[10px] text-muted-foreground">
                    No evidence captured
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Threat</p>
                    <Badge variant={selectedDetection.threat === 'critical' ? 'destructive' : 'secondary'} className="text-[10px] mt-0.5">
                      {selectedDetection.threat.toUpperCase()}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Confidence</p>
                    <p className="font-mono text-sm">{selectedDetection.confidence != null ? `${(selectedDetection.confidence * 100).toFixed(1)}%` : '—'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] text-muted-foreground">Camera</p>
                    <p className="text-xs flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {selectedDetection.camera_name ?? '—'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <aside className="flex flex-col gap-4 min-h-0">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Filter className="h-3.5 w-3.5" /> Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input placeholder="Search camera/class..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={featureFilter}
                onChange={(e) => setFeatureFilter(e.target.value as typeof featureFilter)}
                className="h-9 rounded-md border bg-background px-2 text-xs"
              >
                <option value="all">All features</option>
                <option value="face">Face</option>
                <option value="plate">Plate</option>
                <option value="object">Object</option>
              </select>
              <select
                value={threatFilter}
                onChange={(e) => setThreatFilter(e.target.value as typeof threatFilter)}
                className="h-9 rounded-md border bg-background px-2 text-xs"
              >
                <option value="all">All threats</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            {selectedCameraId && (
              <Button size="sm" variant="ghost" className="w-full" onClick={() => setSelectedCameraId(null)}>
                Clear camera focus
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="flex-1 min-h-0 flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><ScanSearch className="h-3.5 w-3.5" /> Recent Activity</CardTitle>
            <CardDescription>{visibleDetections.length} events</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto space-y-1 pr-1">
            {visibleDetections.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">No detections match filters.</p>
            )}
            {visibleDetections.slice(0, 100).map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedDetection(d)}
                className="w-full text-left text-xs p-2 rounded-md border border-border/40 hover:bg-muted/40 transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium capitalize flex items-center gap-1">
                    {d.feature === 'face' ? <UserCircle2 className="h-3 w-3" /> :
                     d.feature === 'plate' ? <CarFront className="h-3 w-3" /> :
                     <Crosshair className="h-3 w-3" />}
                    {d.class_name ?? d.feature}
                  </span>
                  <Badge variant={d.threat === 'critical' ? 'destructive' : 'secondary'} className="text-[10px]">
                    {d.threat}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-muted-foreground mt-0.5">
                  <span className="truncate">{d.camera_name ?? '—'}</span>
                  <span className="font-mono">{d.confidence != null ? `${(d.confidence * 100).toFixed(0)}%` : '—'} · {new Date(d.ts).toLocaleTimeString()}</span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><ShieldAlert className="h-3.5 w-3.5" /> Top Flagged</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {topFlagged.length === 0 && <p className="text-xs text-muted-foreground">No flagged entities.</p>}
            {topFlagged.map((f) => (
              <div key={`${f.kind}-${f.id}`} className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-muted/40">
                <div className="flex items-center gap-1.5">
                  {f.kind === 'face' ? <UserCircle2 className="h-3.5 w-3.5" /> : <CarFront className="h-3.5 w-3.5" />}
                  <span className="font-medium truncate max-w-[140px]">{f.label}</span>
                </div>
                <Badge variant={f.threat === 'critical' ? 'destructive' : 'secondary'} className="text-[10px]">
                  {f.threat ?? '—'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}
