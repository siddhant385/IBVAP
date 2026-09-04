'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, Polygon, useMap } from 'react-leaflet'
import { useTheme } from 'next-themes'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Badge } from '@/components/ui/badge'
import { Activity, MapPin } from 'lucide-react'
import { useGodsEyeStore } from './store'
import { useFilteredDetections } from './useFilteredDetections'
import { cameraIcon, detectionIcon, zoneColorsFor, parseZone } from './icons'

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    const bounds = L.latLngBounds(points.map((p) => L.latLng(p[0], p[1])))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
  }, [map, points])
  return null
}

interface GodsEyeMapProps {
  initialCameras?: CameraNode[]
  initialZones?: Zone[]
}

export function GodsEyeMap({ initialCameras = [], initialZones = [] }: GodsEyeMapProps) {
  const storeCameras = useGodsEyeStore((s) => s.cameras)
  const storeZones = useGodsEyeStore((s) => s.zones)
  // Use store data if hydrated, otherwise fall back to initial props.
  // This prevents the map from briefly centering on the default fallback
  // before useGodsEyeInit's effect populates the store.
  const cameras = storeCameras.length > 0 ? storeCameras : initialCameras
  const zones = storeZones.length > 0 ? storeZones : initialZones
  const visible = useFilteredDetections()
  const setSelectedCameraId = useGodsEyeStore((s) => s.setSelectedCameraId)
  const setSelectedDetection = useGodsEyeStore((s) => s.setSelectedDetection)
  const selectedCameraId = useGodsEyeStore((s) => s.selectedCameraId)
  const { resolvedTheme } = useTheme()

  const allPoints = cameras.map((c) => c.coordinates).filter((c): c is [number, number] => !!c)
  const center: [number, number] = allPoints[0] ?? [28.6139, 77.2090]

  const cameraCounts = new Map<string, number>()
  for (const d of visible) {
    if (!d.camera_id) continue
    cameraCounts.set(d.camera_id, (cameraCounts.get(d.camera_id) ?? 0) + 1)
  }

  const trails = new Map<string, [number, number][]>()
  for (const d of visible) {
    if (!d.coords) continue
    const key = d.camera_id ?? 'unknown'
    const arr = trails.get(key) ?? []
    arr.push([d.coords[0], d.coords[1]])
    if (arr.length > 50) arr.shift()
    trails.set(key, arr)
  }

  return (
    <MapContainer center={center} zoom={12} className="h-full w-full">
      <TileLayer
        key={resolvedTheme}
        className={resolvedTheme === 'dark' ? 'invert brightness-90 contrast-125 hue-rotate-180' : ''}
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {allPoints.length > 0 && <FitBounds points={allPoints} />}
      {zones.map((z) => {
        const ring = parseZone(z.polygon_wkt)
        if (!ring || ring.length < 3) return null
        const colors = zoneColorsFor(z.type)
        return (
          <Polygon
            key={z.id}
            positions={ring}
            pathOptions={{ color: colors.stroke, fillColor: colors.fill, weight: 2, fillOpacity: 0.12, dashArray: '4 4' }}
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
                      <Activity className="h-2.5 w-2.5 mr-0.5" /> {count}
                    </Badge>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        )
      })}
      {visible.map((d) =>
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
                <p className="text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{d.camera_name ?? '—'}</p>
                {d.confidence != null && <p>Confidence: {(d.confidence * 100).toFixed(1)}%</p>}
                <p>{new Date(d.ts).toLocaleString()}</p>
              </div>
            </Popup>
          </Marker>
        ) : null
      )}
      {Array.from(trails.entries()).map(([camId, pts]) =>
        pts.length > 1 ? (
          <Polyline key={camId} positions={pts} pathOptions={{ color: '#a78bfa', weight: 2, opacity: 0.6 }} />
        ) : null
      )}
      {selectedCameraId && (() => {
        const c = cameras.find((x) => x.id === selectedCameraId)
        if (!c?.coordinates) return null
        return <Circle center={[c.coordinates[0], c.coordinates[1]]} radius={120} pathOptions={{ color: '#22c55e', weight: 1, fillOpacity: 0.1 }} />
      })()}
    </MapContainer>
  )
}
