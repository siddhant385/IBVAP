'use client'

import { useEffect } from 'react'
import { create } from 'zustand'
import { createClient } from '@/utils/supabase/client'
import { deriveThreat, parseCoords, type CameraNode, type DetectionPing, type FlaggedEntity, type ThreatLevel, type TimeWindow, type Zone } from './lib'

interface GodsEyeState {
  cameras: CameraNode[]
  detections: DetectionPing[]
  flagged: FlaggedEntity[]
  zones: Zone[]
  playing: boolean
  search: string
  featureFilter: 'all' | 'face' | 'plate' | 'object'
  threatFilter: 'all' | ThreatLevel
  selectedCameraId: string | null
  selectedDetection: DetectionPing | null
  timeWindow: TimeWindow
  now: number

  setSearch: (v: string) => void
  setFeatureFilter: (v: GodsEyeState['featureFilter']) => void
  setThreatFilter: (v: GodsEyeState['threatFilter']) => void
  setSelectedCameraId: (v: string | null) => void
  setSelectedDetection: (v: DetectionPing | null) => void
  setTimeWindow: (v: TimeWindow) => void
  togglePlaying: () => void
  clearDetections: () => void
  ingestDetection: (d: DetectionPing) => void
  setNow: (n: number) => void
}

export const useGodsEyeStore = create<GodsEyeState>((set) => ({
  cameras: [],
  detections: [],
  flagged: [],
  zones: [],
  playing: true,
  search: '',
  featureFilter: 'all',
  threatFilter: 'all',
  selectedCameraId: null,
  selectedDetection: null,
  timeWindow: '15m',
  now: Date.now(),

  setSearch: (v) => set({ search: v }),
  setFeatureFilter: (v) => set({ featureFilter: v }),
  setThreatFilter: (v) => set({ threatFilter: v }),
  setSelectedCameraId: (v) => set({ selectedCameraId: v }),
  setSelectedDetection: (v) => set({ selectedDetection: v }),
  setTimeWindow: (v) => set({ timeWindow: v }),
  togglePlaying: () => set((s) => ({ playing: !s.playing })),
  clearDetections: () => set({ detections: [] }),
  setNow: (n) => set({ now: n }),
  ingestDetection: (d) => set((s) => ({ detections: [d, ...s.detections].slice(0, 500) })),
}))

export const deriveStoredThreat = (d: DetectionPing): ThreatLevel => deriveThreat(d)

export function useGodsEyeInit(initial: {
  cameras: CameraNode[]
  detections: DetectionPing[]
  flagged: FlaggedEntity[]
  zones: Zone[]
}) {
  useEffect(() => {
    const s = useGodsEyeStore.getState()
    if (s.cameras.length === 0 && s.detections.length === 0 && s.flagged.length === 0) {
      useGodsEyeStore.setState({
        cameras: initial.cameras,
        detections: initial.detections,
        flagged: initial.flagged,
        zones: initial.zones,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

export function useGodsEyeStream() {
  const playing = useGodsEyeStore((s) => s.playing)
  const ingest = useGodsEyeStore((s) => s.ingestDetection)

  useEffect(() => {
    if (!playing) return
    const supabase = createClient()
    const channel = supabase
      .channel('godseye-stream')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'detections' }, async (payload) => {
        const d = payload.new as {
          id: string
          camera_id: string | null
          feature: string
          class_name: string | null
          confidence: number | null
          timestamp: string
          camera_coords: [number, number] | string | null
          evidence_path: string | null
        }
        const coords = parseCoords(d.camera_coords)
        if (!coords) return
        const { data: cam } = await supabase.from('cameras').select('name').eq('id', d.camera_id).single()
        ingest({
          id: d.id,
          camera_id: d.camera_id,
          camera_name: cam?.name ?? null,
          feature: d.feature,
          class_name: d.class_name,
          confidence: d.confidence,
          ts: d.timestamp,
          coords,
          evidence_path: d.evidence_path,
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [playing, ingest])
}

export function useGodsEyeClock() {
  const setNow = useGodsEyeStore((s) => s.setNow)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [setNow])
}
