'use client'

import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { createClient } from '@/utils/supabase/client'
import { MapContainer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { extendLeaflet } from '@india-boundary-corrector/leaflet-layer'
import 'leaflet/dist/leaflet.css'

// Extend Leaflet once
extendLeaflet(L)

interface CameraMarker {
  id: string
  name: string | null
  location: string | null
  is_online: boolean
  coordinates: [number, number]
}

const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

function IndiaCorrectedTileLayer() {
  const map = useMap()
  const layerRef = useRef<L.TileLayer | null>(null)

  useEffect(() => {
    if (!map) return

    // Create the corrected tile layer
    const correctedLayer = L.tileLayer.indiaBoundaryCorrected(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }
    )

    correctedLayer.addTo(map)
    layerRef.current = correctedLayer

    return () => {
      if (layerRef.current && map) {
        map.removeLayer(layerRef.current)
      }
    }
  }, [map])

  return null
}

export function CommandMap({ initialCameras }: { initialCameras: CameraMarker[] }) {
  const [cameras, setCameras] = useState<CameraMarker[]>(initialCameras)
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('command-center-map')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cameras' }, (payload) => {
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          const updated = payload.new as {
            id: string
            name?: string | null
            location?: string | null
            is_online?: boolean
            coordinates?: [number, number] | string
          }
          if (updated.coordinates) {
            setCameras((prev) => {
              const idx = prev.findIndex((c) => c.id === updated.id)
              const item: CameraMarker = {
                id: updated.id,
                name: updated.name ?? null,
                location: updated.location ?? null,
                is_online: Boolean(updated.is_online),
                coordinates: typeof updated.coordinates === 'string' 
                  ? JSON.parse(updated.coordinates) 
                  : updated.coordinates
              }
              if (idx >= 0) {
                const copy = [...prev]
                copy[idx] = item
                return copy
              }
              return [...prev, item]
            })
          }
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const center: [number, number] = cameras.length > 0 && cameras[0].coordinates
    ? [cameras[0].coordinates[0], cameras[0].coordinates[1]]
    : [28.6139, 77.2090]

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Geospatial Intelligence Map</CardTitle>
        <CardDescription>Live telemetry and node coverage positioning</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 min-h-[350px] p-0 relative overflow-hidden rounded-b-xl">
        <MapContainer center={center} zoom={13} className="h-full w-full min-h-[350px]">
          <IndiaCorrectedTileLayer />
          {cameras.map((cam) => (
            cam.coordinates ? (
              <Marker key={cam.id} position={[cam.coordinates[0], cam.coordinates[1]]} icon={defaultIcon}>
                <Popup>
                  <div className="text-xs">
                    <p className="font-bold">{cam.name || 'Camera Node'}</p>
                    <p className="text-muted-foreground">{cam.location || 'Unknown location'}</p>
                    <span className={`inline-block mt-1 px-1.5 py-0.5 text-[10px] rounded ${cam.is_online ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {cam.is_online ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                </Popup>
              </Marker>
            ) : null
          ))}
        </MapContainer>
      </CardContent>
    </Card>
  )
}
