'use client'

import L from 'leaflet'
import { THREAT_COLORS, parsePolygonWKT, ZONE_COLORS, type CameraNode, type ThreatLevel } from './lib'

export const cameraIcon = (online: boolean) =>
  L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${online ? '#22c55e' : '#64748b'};box-shadow:0 0 0 2px white, 0 0 0 3px ${online ? '#22c55e' : '#64748b'}99;"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })

export const detectionIcon = (threat: ThreatLevel) => {
  const color = THREAT_COLORS[threat]
  const size = threat === 'critical' ? 22 : threat === 'high' ? 20 : 18
  const anim = threat === 'critical' ? '1.2s' : '1.8s'
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:${size}px;height:${size}px;">
      <div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:0.35;animation:pulse ${anim} infinite;"></div>
      <div style="position:absolute;top:${size/2-4}px;left:${size/2-4}px;width:8px;height:8px;border-radius:50%;background:${color};border:2px solid white;"></div>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
  })
}

export const zoneColorsFor = (type: string) => ZONE_COLORS[type] ?? ZONE_COLORS.default
export const parseZone = parsePolygonWKT
export type { CameraNode }
