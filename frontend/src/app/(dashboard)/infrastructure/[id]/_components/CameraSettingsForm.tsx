'use client'

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useToastManager } from '@/components/ui/toast'
import { createClient } from '@/utils/supabase/client'
import {
  FloppyDiskIcon,
  CloudSlashIcon,
  CircleNotchIcon,
} from '@phosphor-icons/react/dist/ssr'
import { VirtualFenceCanvas, type Polygon } from './canvas/VirtualFenceCanvas'
import { VirtualBorderCanvas } from './canvas/VirtualBorderCanvas'
import { CameraLiveStatus } from './CameraLiveStatus'
import { SettingsFormSkeleton } from './settings/SettingsFormSkeleton'
import { DetectionModeCard, type DetectionMode } from './settings/DetectionModeCard'
import { AdditionalPluginsCard } from './settings/AdditionalPluginsCard'
import { InferenceSettingsCard, type InferenceSettings } from './settings/InferenceSettingsCard'
import { EvidenceSettingsCard, type EvidenceSettings } from './settings/EvidenceSettingsCard'
import { LastDetectionPreview } from './settings/LastDetectionPreview'
import { useSnapshot } from './hooks/useSnapshot'
import { cn } from '@/lib/utils'

interface CameraSettingsData {
  id?: string
  source?: string
  process_every_n_frames?: number
  inference_size?: number
  confidence_threshold?: number
  nms_threshold?: number
  target_class_ids?: number[]
  enabled_plugins?: string[]
  intrusion_zone_polygon?: Array<[number, number]>
  virtual_border_line?: Array<[number, number]> | null
  evidence_source_feature?: string
  evidence_max_width?: number
  evidence_jpeg_quality?: number
  [key: string]: unknown
}

interface CameraSettingsFormProps {
  cameraId: string
  hardwareDeviceId?: string
  hardwareCameraId?: string
  initialSettings: CameraSettingsData
}

const DEFAULTS: Required<InferenceSettings & EvidenceSettings> = {
  confidence_threshold: 0.45,
  nms_threshold: 0.5,
  process_every_n_frames: 5,
  inference_size: 640,
  target_class_ids: [0],
  evidence_max_width: 1280,
  evidence_jpeg_quality: 75,
}

export function CameraSettingsForm({
  cameraId,
  hardwareDeviceId,
  hardwareCameraId,
  initialSettings,
}: CameraSettingsFormProps) {
  const [supabase] = useState(() => createClient())
  const [settings, setSettings] = useState<CameraSettingsData>(initialSettings || {})
  const [isSaving, setIsSaving] = useState(false)
  const [isCameraOnline, setIsCameraOnline] = useState<boolean | null>(null)
  const [isDeviceOnline, setIsDeviceOnline] = useState<boolean | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const toast = useToastManager()

  // Defer first paint by one tick so the form skeleton shows on initial mount.
  useEffect(() => {
    const t = setTimeout(() => setHydrated(true), 0)
    return () => clearTimeout(t)
  }, [])

  // Snapshot for the LastDetectionPreview overlay
  const { snapshotUrl, isRequestingSnapshot, snapshotStatus, requestSnapshot } = useSnapshot({
    hardwareDeviceId,
    hardwareCameraId,
  })

  // Subscribe to camera online status
  useEffect(() => {
    if (!hardwareCameraId) return
    const channel = supabase
      .channel(`settings_form_status:${hardwareCameraId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cameras',
          filter: `camera_id=eq.${hardwareCameraId}`,
        },
        (payload) => setIsCameraOnline((payload.new as { is_online: boolean }).is_online)
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, hardwareCameraId])

  // Subscribe to device online status
  useEffect(() => {
    if (!hardwareDeviceId) return
    const channel = supabase
      .channel(`settings_form_device:${hardwareDeviceId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'devices',
          filter: `device_id=eq.${hardwareDeviceId}`,
        },
        (payload) => setIsDeviceOnline((payload.new as { is_online: boolean }).is_online)
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, hardwareDeviceId])

  // Subscribe to camera_settings changes; refresh if user has not edited locally.
  useEffect(() => {
    if (!hardwareCameraId) return
    let isDirty = false
    const onUserInput = () => { isDirty = true }
    const channel = supabase
      .channel(`camera_settings:${hardwareCameraId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'camera_settings',
          filter: `camera_id=eq.${hardwareCameraId}`,
        },
        (payload) => {
          if (isDirty) {
            toast.add({
              type: 'warning',
              title: 'Settings changed elsewhere',
              description: 'Reload the page to see the latest values from the edge device.',
            })
            return
          }
          const row = payload.new as { settings?: CameraSettingsData } | undefined
          if (row?.settings) setSettings(row.settings)
        }
      )
      .subscribe()
    window.addEventListener('pointerdown', onUserInput, { passive: true })
    window.addEventListener('keydown', onUserInput)
    return () => {
      window.removeEventListener('pointerdown', onUserInput)
      window.removeEventListener('keydown', onUserInput)
      supabase.removeChannel(channel)
    }
  }, [supabase, hardwareCameraId, toast])

  const getDetectionMode = useCallback((): DetectionMode => {
    const plugins = settings.enabled_plugins || []
    if (plugins.includes('intrusion_detection')) return 'intrusion_detection'
    if (plugins.includes('virtual_border')) return 'virtual_border'
    return 'object_detection'
  }, [settings.enabled_plugins])

  const [detectionMode, setDetectionMode] = useState<DetectionMode>(getDetectionMode())

  const isPluginEnabled = (pluginId: string): boolean =>
    (settings.enabled_plugins || []).includes(pluginId)

  const handleDetectionModeChange = (mode: DetectionMode) => {
    setDetectionMode(mode)
    const currentPlugins = settings.enabled_plugins || []
    const additionalPlugins = currentPlugins.filter(
      (p) => p === 'object_tracking' || p === 'evidence_capture'
    )
    let newPlugins: string[] = [mode, ...additionalPlugins]
    if (
      (mode === 'virtual_border' || mode === 'intrusion_detection') &&
      !additionalPlugins.includes('evidence_capture')
    ) {
      newPlugins = [...newPlugins, 'evidence_capture']
    }
    setSettings((prev) => ({ ...prev, enabled_plugins: newPlugins }))
  }

  const toggleAdditionalPlugin = (pluginId: 'object_tracking' | 'evidence_capture') => {
    const currentPlugins = settings.enabled_plugins || []
    const detectionPlugins = currentPlugins.filter(
      (p) => p === 'object_detection' || p === 'virtual_border' || p === 'intrusion_detection'
    )
    const additionalPlugins = currentPlugins.filter(
      (p) => p === 'object_tracking' || p === 'evidence_capture'
    )
    const next = additionalPlugins.includes(pluginId)
      ? additionalPlugins.filter((p) => p !== pluginId)
      : [...additionalPlugins, pluginId]
    setSettings((prev) => ({ ...prev, enabled_plugins: [...detectionPlugins, ...next] }))
  }

  // Optimistic update for sliders / inputs / number fields
  const updateSettings = (patch: Record<string, unknown>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }

  const handlePolygonSave = (polygons: Polygon[]) => {
    if (polygons.length > 0 && polygons[0].points.length >= 3) {
      const polygonPoints: Array<[number, number]> = polygons[0].points.map((p) => [p.x, p.y])
      setSettings((prev) => ({ ...prev, intrusion_zone_polygon: polygonPoints }))
    } else {
      setSettings((prev) => ({ ...prev, intrusion_zone_polygon: [] }))
    }
  }

  const handleBorderLineSave = (borderLine: Array<[number, number]> | null) => {
    setSettings((prev) => ({ ...prev, virtual_border_line: borderLine }))
  }

  const validate = (): string | null => {
    if (detectionMode === 'intrusion_detection') {
      const polygon = settings.intrusion_zone_polygon
      if (!polygon || polygon.length < 3) return 'Please draw an intrusion zone polygon before saving.'
    }
    if (detectionMode === 'virtual_border') {
      const borderLine = settings.virtual_border_line
      if (!borderLine || borderLine.length !== 2) return 'Please draw a border line before saving.'
    }
    return null
  }

  const handleSave = async () => {
    const error = validate()
    if (error) {
      toast.add({ title: 'Configuration Required', description: error, type: 'error' })
      return
    }

    setIsSaving(true)

    // Optimistic: bump version locally; if the server confirms, fine. If it fails, we re-throw.
    const payload = {
      ...settings,
      process_every_n_frames: Number(settings.process_every_n_frames ?? DEFAULTS.process_every_n_frames),
      inference_size: Number(settings.inference_size ?? DEFAULTS.inference_size),
      confidence_threshold: Number(settings.confidence_threshold ?? DEFAULTS.confidence_threshold),
      nms_threshold: Number(settings.nms_threshold ?? DEFAULTS.nms_threshold),
      evidence_max_width: Number(settings.evidence_max_width ?? DEFAULTS.evidence_max_width),
      evidence_jpeg_quality: Number(settings.evidence_jpeg_quality ?? DEFAULTS.evidence_jpeg_quality),
      target_class_ids: settings.target_class_ids || DEFAULTS.target_class_ids,
    }
    const version = crypto.randomUUID()

    // Optimistic toast immediately so the click feels responsive
    const optimisticId = toast.add({
      type: 'info',
      title: 'Saving...',
      description: 'Pushing configuration to the edge device.',
    })

    try {
      const { error: upsertError } = await supabase
        .from('camera_settings')
        .upsert(
          { camera_id: cameraId, settings: payload, version },
          { onConflict: 'camera_id' }
        )

      if (upsertError) throw upsertError

      const deviceOffline = isDeviceOnline === false
      const cameraOffline = isCameraOnline === false

      toast.update(optimisticId, {
        type: 'success',
        title: 'Settings Saved',
        description: deviceOffline || cameraOffline
          ? 'Saved locally. Will sync to edge device when it comes online.'
          : 'Camera configuration has been pushed to the edge device.',
      })
    } catch (err) {
      console.error('Save error:', err)
      toast.update(optimisticId, {
        type: 'error',
        title: 'Save failed',
        description: 'Failed to save camera settings. Please try again.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const isOffline = isDeviceOnline === false || isCameraOnline === false
  const evidenceEnabled = isPluginEnabled('evidence_capture')
  const showZoneCanvas =
    detectionMode === 'intrusion_detection' || detectionMode === 'virtual_border'

  if (!hydrated) return <SettingsFormSkeleton />

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-6">
        {isOffline && (
          <Alert className="border-amber-500/30 bg-amber-500/5">
            <CloudSlashIcon className="size-4 text-amber-600" />
            <AlertTitle className="text-amber-600">
              {isDeviceOnline === false ? 'Device Offline' : 'Camera Offline'}
            </AlertTitle>
            <AlertDescription>
              {isDeviceOnline === false
                ? 'The edge device is not connected. Live snapshot fetching is disabled. Settings will sync when the device reconnects.'
                : 'This camera is not actively streaming. Live snapshot fetching is disabled. Settings will sync when the camera reconnects.'}
            </AlertDescription>
          </Alert>
        )}

        <DetectionModeCard value={detectionMode} onChange={handleDetectionModeChange} />

        {showZoneCanvas && (
          <Card className="border-border/50 overflow-hidden">
            <CardContent className="p-0">
              {detectionMode === 'intrusion_detection' ? (
                <VirtualFenceCanvas
                  cameraId={cameraId}
                  hardwareDeviceId={hardwareDeviceId}
                  hardwareCameraId={hardwareCameraId}
                  initialPolygons={
                    settings.intrusion_zone_polygon && settings.intrusion_zone_polygon.length >= 3
                      ? [
                          {
                            id: 'zone-1',
                            label: 'Zone 1',
                            points: settings.intrusion_zone_polygon.map((p) => ({ x: p[0], y: p[1] })),
                          },
                        ]
                      : []
                  }
                  onSave={handlePolygonSave}
                  isOffline={isOffline}
                />
              ) : (
                <VirtualBorderCanvas
                  cameraId={cameraId}
                  hardwareDeviceId={hardwareDeviceId}
                  hardwareCameraId={hardwareCameraId}
                  initialBorderLine={settings.virtual_border_line}
                  onSave={handleBorderLineSave}
                  isOffline={isOffline}
                />
              )}
            </CardContent>
          </Card>
        )}

        <AdditionalPluginsCard
          enabledPlugins={settings.enabled_plugins || []}
          onToggle={toggleAdditionalPlugin}
        />

        <InferenceSettingsCard
          settings={settings}
          onChange={(patch) => updateSettings(patch)}
        />

        {evidenceEnabled && (
          <EvidenceSettingsCard
            settings={settings}
            onChange={(patch) => updateSettings(patch)}
          />
        )}

        <div className={cn("flex justify-end gap-3", isSaving && "opacity-90")}>
          <Button
            size="lg"
            onClick={handleSave}
            disabled={isSaving}
            className="min-w-[160px]"
          >
            {isSaving ? (
              <>
                <CircleNotchIcon className="size-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <FloppyDiskIcon className="size-4" />
                Push to Edge
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <CameraLiveStatus cameraId={cameraId} hardwareDeviceId={hardwareDeviceId} />
        <LastDetectionPreview
          cameraId={cameraId}
          snapshotUrl={snapshotUrl}
          onRequestSnapshot={requestSnapshot}
          isRequestingSnapshot={isRequestingSnapshot}
          snapshotStatus={snapshotStatus}
          imageWidth={null}
          imageHeight={null}
        />
      </div>
    </div>
  )
}
