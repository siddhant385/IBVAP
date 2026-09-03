'use client'

import { useEffect } from 'react'
import { useGodsEyeStore } from './store'
import { WINDOW_MS, deriveThreat, type DetectionPing } from './lib'

export interface EnrichedDetection extends DetectionPing {
  threat: ReturnType<typeof deriveThreat>
}

export function useFilteredDetections(): EnrichedDetection[] {
  const detections = useGodsEyeStore((s) => s.detections)
  const search = useGodsEyeStore((s) => s.search)
  const featureFilter = useGodsEyeStore((s) => s.featureFilter)
  const threatFilter = useGodsEyeStore((s) => s.threatFilter)
  const selectedCameraId = useGodsEyeStore((s) => s.selectedCameraId)
  const timeWindow = useGodsEyeStore((s) => s.timeWindow)
  const now = useGodsEyeStore((s) => s.now)

  useEffect(() => {}, [now])

  const cutoff = now - WINDOW_MS[timeWindow]
  const searchLower = search.toLowerCase()
  const out: EnrichedDetection[] = []
  for (const d of detections) {
    if (new Date(d.ts).getTime() < cutoff) continue
    if (featureFilter !== 'all' && d.feature !== featureFilter) continue
    const threat = deriveThreat(d)
    if (threatFilter !== 'all' && threat !== threatFilter) continue
    if (selectedCameraId && d.camera_id !== selectedCameraId) continue
    if (searchLower && !`${d.camera_name ?? ''} ${d.class_name ?? ''}`.toLowerCase().includes(searchLower)) continue
    out.push({ ...d, threat })
  }
  return out
}
