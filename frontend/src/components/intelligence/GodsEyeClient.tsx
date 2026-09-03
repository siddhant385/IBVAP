'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/utils/supabase/client'
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet'
import { useTheme } from 'next-themes'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Crosshair, Eye, Filter, Pause, Play, RefreshCw, ScanSearch, ShieldAlert, UserCircle2, CarFront } from 'lucide-react'

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

const cameraIcon = (online: boolean) =>
  L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${online ? '#22c55e' : '#64748b'};box-shadow:0 0 0 2px white, 0 0 0 3px ${online ? '#22c55e' : '#64748b'}99;"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })

const detectionIcon = (threat: DetectionPing['threat']) => {
  const color =
    threat === 'critical' ? '#ef4444' :
    threat === 'high' ? '#f97316' :
    threat === 'medium' ? '#eab308' :
    threat === 'low' ? '#3b82f6' : '#94a3b8'
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:18px;height:18px;">
      <div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:0.35;animation:pulse 1.6s infinite;"></div>
      <div style="position:absolute;top:5px;left:5px;width:8px;height:8px;border-radius:50%;background:${color};border:2px solid white;"></div>
    </div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
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
  const { resolvedTheme } = useTheme()
  const supabase = createClient()

  useEffect(() => {
    if (!playing) return
    const channel = supabase
      .channel('godseye-stream')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'detections' }, async (payload) => {
        const d = payload.new as { id: string; camera_id: string | null; feature: string; class_name: string | null; confidence: number | null; timestamp: string; camera_coords: [number, number] | string | null }
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
          threat: 'low',
        }
        setDetections((prev) => [ping, ...prev].slice(0, 200))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [playing, supabase])

  const visibleDetections = useMemo(() => {
    return detections.filter((d) => {
      if (featureFilter !== 'all' && d.feature !== featureFilter) return false
      if (threatFilter !== 'all' && d.threat !== threatFilter) return false
      if (selectedCameraId && d.camera_id !== selectedCameraId) return false
      if (search && !`${d.camera_name ?? ''} ${d.class_name ?? ''}`.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [detections, featureFilter, threatFilter, selectedCameraId, search])

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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 h-[calc(100vh-180px)]">
      <Card className="flex flex-col overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                God&apos;s Eye View
              </CardTitle>
              <CardDescription>Live detections across all camera nodes</CardDescription>
            </div>
            <div className="flex items-center gap-2">
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
              if (!ring) return null
              return (
                <Polyline
                  key={z.id}
                  positions={ring}
                  pathOptions={{ color: z.type === 'restricted' ? '#ef4444' : '#3b82f6', weight: 2, dashArray: '6 4' }}
                />
              )
            })}
            {cameras.map((cam) =>
              cam.coordinates ? (
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
                      <Badge variant={cam.is_online ? 'default' : 'secondary'} className="mt-1">
                        {cam.is_online ? 'ONLINE' : 'OFFLINE'}
                      </Badge>
                    </div>
                  </Popup>
                </Marker>
              ) : null
            )}
            {visibleDetections.map((d) =>
              d.coords ? (
                <Marker key={d.id} position={[d.coords[0], d.coords[1]]} icon={detectionIcon(d.threat)}>
                  <Popup>
                    <div className="text-xs space-y-0.5">
                      <p className="font-bold capitalize">{d.feature}{d.class_name ? `: ${d.class_name}` : ''}</p>
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
            {visibleDetections.map((d) => (
              <button
                key={d.id}
                onClick={() => d.camera_id && setSelectedCameraId(d.camera_id)}
                className="w-full text-left text-xs p-2 rounded-md border border-border/40 hover:bg-muted/40 transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium capitalize flex items-center gap-1">
                    {d.feature === 'face' ? <UserCircle2 className="h-3 w-3" /> :
                     d.feature === 'plate' ? <CarFront className="h-3 w-3" /> :
                     <Crosshair className="h-3 w-3" />}
                    {d.class_name ?? d.feature}
                  </span>
                  {d.confidence != null && (
                    <span className="text-muted-foreground">{(d.confidence * 100).toFixed(0)}%</span>
                  )}
                </div>
                <div className="flex items-center justify-between text-muted-foreground mt-0.5">
                  <span className="truncate">{d.camera_name ?? '—'}</span>
                  <span>{new Date(d.ts).toLocaleTimeString()}</span>
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
