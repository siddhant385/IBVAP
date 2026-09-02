'use client'

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useToastManager } from '@/components/ui/toast'
import { createClient } from '@/utils/supabase/client'
import { 
  FloppyDiskIcon, 
  EyeIcon, 
  PathIcon, 
  ShieldWarningIcon,
  VideoIcon, 
  FileImageIcon,
  LightningIcon,
  TargetIcon,
  GearIcon,
  CloudSlashIcon,
  CircleNotchIcon,
} from '@phosphor-icons/react/dist/ssr'
import { VirtualFenceCanvas, type Polygon } from './canvas/VirtualFenceCanvas'
import { VirtualBorderCanvas } from './canvas/VirtualBorderCanvas'
import { CameraLiveStatus } from './CameraLiveStatus'
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldSet } from '@/components/ui/field'
import { cn } from '@/lib/utils'

// Detection mode types
type DetectionMode = 'object_detection' | 'virtual_border' | 'intrusion_detection'

// Plugin configuration
const DETECTION_MODES: Array<{
  id: DetectionMode
  name: string
  description: string
  icon: React.ReactNode
  color: string
  requiresConfig: boolean
}> = [
  {
    id: 'object_detection',
    name: 'Object Detection',
    description: 'Detect and track all objects in frame',
    icon: <EyeIcon className="size-5" />,
    color: 'bg-blue-500/10 border-blue-500/50 text-blue-600',
    requiresConfig: false
  },
  {
    id: 'virtual_border',
    name: 'Virtual Border',
    description: 'Detect objects crossing a line boundary',
    icon: <PathIcon className="size-5" />,
    color: 'bg-amber-500/10 border-amber-500/50 text-amber-600',
    requiresConfig: true
  },
  {
    id: 'intrusion_detection',
    name: 'Intrusion Detection',
    description: 'Detect objects entering a defined zone',
    icon: <ShieldWarningIcon className="size-5" />,
    color: 'bg-red-500/10 border-red-500/50 text-red-600',
    requiresConfig: true
  }
]

const ADDITIONAL_PLUGINS: Array<{
  id: 'object_tracking' | 'evidence_capture'
  name: string
  description: string
  icon: React.ReactNode
}> = [
  {
    id: 'object_tracking',
    name: 'Object Tracking',
    description: 'Assign unique IDs to track objects across frames',
    icon: <VideoIcon className="size-4" />
  },
  {
    id: 'evidence_capture',
    name: 'Evidence Capture',
    description: 'Save snapshots when events are detected',
    icon: <FileImageIcon className="size-4" />
  }
]

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

export function CameraSettingsForm({ 
  cameraId, 
  hardwareDeviceId,
  hardwareCameraId,
  initialSettings 
}: CameraSettingsFormProps) {
  const supabase = createClient()
  const [settings, setSettings] = useState<CameraSettingsData>(initialSettings || {})
  const [isSaving, setIsSaving] = useState(false)
  const [isCameraOnline, setIsCameraOnline] = useState<boolean | null>(null)
  const [isDeviceOnline, setIsDeviceOnline] = useState<boolean | null>(null)
  const toast = useToastManager()

  // Subscribe to camera online status
  useEffect(() => {
    if (!hardwareCameraId) return

    const fetchCameraStatus = async () => {
      const { data } = await supabase
        .from('cameras')
        .select('is_online')
        .eq('camera_id', hardwareCameraId)
        .maybeSingle()
      
      if (data) {
        setIsCameraOnline(data.is_online)
      }
    }

    fetchCameraStatus()

    const channel = supabase
      .channel(`settings_form_status:${hardwareCameraId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cameras',
          filter: `camera_id=eq.${hardwareCameraId}`
        },
        (payload) => {
          const updated = payload.new as { is_online: boolean }
          setIsCameraOnline(updated.is_online)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
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
          filter: `device_id=eq.${hardwareDeviceId}`
        },
        (payload) => {
          const updated = payload.new as { is_online: boolean }
          setIsDeviceOnline(updated.is_online)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, hardwareDeviceId])

  const getDetectionMode = useCallback((): DetectionMode => {
    const plugins = settings.enabled_plugins || []
    if (plugins.includes('intrusion_detection')) return 'intrusion_detection'
    if (plugins.includes('virtual_border')) return 'virtual_border'
    return 'object_detection'
  }, [settings.enabled_plugins])

  const [detectionMode, setDetectionMode] = useState<DetectionMode>(getDetectionMode())

  const isPluginEnabled = (pluginId: string): boolean => {
    return (settings.enabled_plugins || []).includes(pluginId)
  }

  const handleDetectionModeChange = (mode: DetectionMode) => {
    setDetectionMode(mode)
    
    const currentPlugins = settings.enabled_plugins || []
    const additionalPlugins = currentPlugins.filter(p => 
      p === 'object_tracking' || p === 'evidence_capture'
    )
    
    let newPlugins: string[] = [mode, ...additionalPlugins]
    
    if ((mode === 'virtual_border' || mode === 'intrusion_detection') && 
        !additionalPlugins.includes('evidence_capture')) {
      newPlugins = [...newPlugins, 'evidence_capture']
    }
    
    setSettings(prev => ({ ...prev, enabled_plugins: newPlugins }))
  }

  const toggleAdditionalPlugin = (pluginId: 'object_tracking' | 'evidence_capture') => {
    const currentPlugins = settings.enabled_plugins || []
    const detectionPlugins = currentPlugins.filter(p => 
      p === 'object_detection' || p === 'virtual_border' || p === 'intrusion_detection'
    )
    const additionalPlugins = currentPlugins.filter(p => 
      p === 'object_tracking' || p === 'evidence_capture'
    )
    
    let newAdditionalPlugins: string[]
    if (additionalPlugins.includes(pluginId)) {
      newAdditionalPlugins = additionalPlugins.filter(p => p !== pluginId)
    } else {
      newAdditionalPlugins = [...additionalPlugins, pluginId]
    }
    
    setSettings(prev => ({ 
      ...prev, 
      enabled_plugins: [...detectionPlugins, ...newAdditionalPlugins] 
    }))
  }

  const updateSetting = (key: string, value: string | number | boolean | number[]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const handlePolygonSave = async (polygons: Polygon[]) => {
    if (polygons.length > 0 && polygons[0].points.length >= 3) {
      const polygonPoints: Array<[number, number]> = polygons[0].points.map(p => [p.x, p.y])
      setSettings(prev => ({ ...prev, intrusion_zone_polygon: polygonPoints }))
    } else {
      setSettings(prev => ({ ...prev, intrusion_zone_polygon: [] }))
    }
  }

  const handleBorderLineSave = async (borderLine: Array<[number, number]> | null) => {
    setSettings(prev => ({ ...prev, virtual_border_line: borderLine }))
  }

  const handleSave = async () => {
    if (detectionMode === 'intrusion_detection') {
      const polygon = settings.intrusion_zone_polygon
      if (!polygon || polygon.length < 3) {
        toast.add({ 
          title: 'Configuration Required', 
          description: 'Please draw an intrusion zone polygon before saving.',
          type: 'error'
        })
        return
      }
    }
    
    if (detectionMode === 'virtual_border') {
      const borderLine = settings.virtual_border_line
      if (!borderLine || borderLine.length !== 2) {
        toast.add({ 
          title: 'Configuration Required', 
          description: 'Please draw a border line before saving.',
          type: 'error'
        })
        return
      }
    }

    setIsSaving(true)
    
    try {
      const payload = {
        ...settings,
        process_every_n_frames: Number(settings.process_every_n_frames || 5),
        inference_size: Number(settings.inference_size || 640),
        confidence_threshold: Number(settings.confidence_threshold || 0.45),
        nms_threshold: Number(settings.nms_threshold || 0.5),
        evidence_max_width: Number(settings.evidence_max_width || 1280),
        evidence_jpeg_quality: Number(settings.evidence_jpeg_quality || 75),
        target_class_ids: settings.target_class_ids || [0],
      }

      const { error } = await supabase
        .from('camera_settings')
        .upsert({
          camera_id: cameraId,
          settings: payload,
          version: crypto.randomUUID()
        }, { onConflict: 'camera_id' })

      if (error) throw error

      const deviceOffline = isDeviceOnline === false
      const cameraOffline = isCameraOnline === false
      
      toast.add({ 
        title: 'Settings Saved', 
        description: deviceOffline || cameraOffline
          ? 'Saved locally. Will sync to edge device when it comes online.'
          : 'Camera configuration has been pushed to the edge device.',
      })
    } catch (error) {
      console.error('Save error:', error)
      toast.add({ 
        title: 'Error', 
        description: 'Failed to save camera settings.',
        type: 'error'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const isOffline = isDeviceOnline === false || isCameraOnline === false

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Main settings column */}
      <div className="flex flex-col gap-6">
        {/* Offline warning */}
        {isOffline && (
          <Alert className="border-amber-500/30 bg-amber-500/5">
            <CloudSlashIcon className="size-4 text-amber-600" />
            <AlertTitle className="text-amber-600">
              {isDeviceOnline === false ? 'Device Offline' : 'Camera Offline'}
            </AlertTitle>
            <AlertDescription>
              {isDeviceOnline === false 
                ? 'The edge device is not connected. Live snapshot fetching is disabled. Settings will sync when the device reconnects.'
                : 'This camera is not actively streaming. Live snapshot fetching is disabled. Settings will sync when the camera reconnects.'
              }
            </AlertDescription>
          </Alert>
        )}

        {/* Detection Mode Selection */}
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                <TargetIcon className="size-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Detection Mode</CardTitle>
                <CardDescription>Select how this camera detects objects</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              {DETECTION_MODES.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => handleDetectionModeChange(mode.id)}
                  className={cn(
                    "relative flex flex-col items-start gap-3 rounded-xl border-2 p-4 text-left transition-all",
                    detectionMode === mode.id
                      ? `${mode.color} border-current shadow-sm`
                      : 'bg-muted/30 border-border/50 hover:bg-muted/50 hover:border-border'
                  )}
                >
                  <div className={cn(
                    "flex size-10 items-center justify-center rounded-lg",
                    detectionMode === mode.id ? 'bg-current/10' : 'bg-muted'
                  )}>
                    <span className={detectionMode === mode.id ? 'text-current' : 'text-muted-foreground'}>
                      {mode.icon}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{mode.name}</span>
                      {mode.requiresConfig && detectionMode === mode.id && (
                        <Badge variant="outline" className="text-xs">Needs Config</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{mode.description}</p>
                  </div>
                  {detectionMode === mode.id && (
                    <div className="absolute right-2 top-2 size-2 rounded-full bg-current" />
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Zone Configuration Canvas */}
        {(detectionMode === 'intrusion_detection' || detectionMode === 'virtual_border') && (
          <Card className="border-border/50 overflow-hidden">
            <CardHeader className="bg-muted/30 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10">
                  {detectionMode === 'intrusion_detection' 
                    ? <ShieldWarningIcon className="size-5 text-red-500" />
                    : <PathIcon className="size-5 text-amber-500" />
                  }
                </div>
                <div>
                  <CardTitle className="text-base">
                    {detectionMode === 'intrusion_detection' ? 'Intrusion Zone' : 'Border Line'}
                  </CardTitle>
                  <CardDescription>
                    {detectionMode === 'intrusion_detection' 
                      ? 'Draw a polygon zone where intrusion will be detected'
                      : 'Draw a line boundary to detect crossing objects'
                    }
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {detectionMode === 'intrusion_detection' ? (
                <VirtualFenceCanvas
                  cameraId={cameraId}
                  hardwareDeviceId={hardwareDeviceId}
                  hardwareCameraId={hardwareCameraId}
                  initialPolygons={settings.intrusion_zone_polygon && settings.intrusion_zone_polygon.length >= 3
                    ? [{ 
                        id: 'zone-1', 
                        label: 'Zone 1', 
                        points: settings.intrusion_zone_polygon.map(p => ({ x: p[0], y: p[1] })) 
                      }]
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

        {/* Additional Plugins */}
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                <LightningIcon className="size-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Additional Features</CardTitle>
                <CardDescription>Optional enhancements for detection</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              {ADDITIONAL_PLUGINS.map((plugin) => (
                <div
                  key={plugin.id}
                  className={cn(
                    "flex items-center justify-between rounded-xl border p-4 transition-all",
                    isPluginEnabled(plugin.id)
                      ? 'bg-primary/5 border-primary/30'
                      : 'bg-muted/30 border-border/50'
                  )}
                >
                  <Field orientation="horizontal" className="flex-1 gap-3">
                    <div className={cn(
                      "flex size-9 items-center justify-center rounded-lg",
                      isPluginEnabled(plugin.id) ? 'bg-primary/10' : 'bg-muted'
                    )}>
                      <span className={isPluginEnabled(plugin.id) ? 'text-primary' : 'text-muted-foreground'}>
                        {plugin.icon}
                      </span>
                    </div>
                    <FieldContent>
                      <FieldLabel htmlFor={plugin.id} className="font-medium cursor-pointer">
                        {plugin.name}
                      </FieldLabel>
                      <FieldDescription className="text-xs">
                        {plugin.description}
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                  <Switch
                    id={plugin.id}
                    checked={isPluginEnabled(plugin.id)}
                    onCheckedChange={() => toggleAdditionalPlugin(plugin.id)}
                  />
                </div>
              ))}
            </FieldGroup>
          </CardContent>
        </Card>

        {/* Inference Settings */}
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                <GearIcon className="size-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Inference Settings</CardTitle>
                <CardDescription>Fine-tune model parameters</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <FieldGroup className="flex flex-col gap-6">
              {/* Sliders */}
              <div className="grid gap-6 sm:grid-cols-2">
                <Field>
                  <div className="flex items-center justify-between">
                    <FieldLabel>Confidence Threshold</FieldLabel>
                    <Badge variant="secondary" className="font-mono">
                      {((settings.confidence_threshold as number) || 0.45).toFixed(2)}
                    </Badge>
                  </div>
                  <Slider
                    value={[(settings.confidence_threshold as number) || 0.45]}
                    min={0.1}
                    max={0.95}
                    step={0.01}
                    onValueChange={(val) => updateSetting('confidence_threshold', Array.isArray(val) ? val[0] : val)}
                  />
                  <FieldDescription>
                    Minimum confidence score to register a detection
                  </FieldDescription>
                </Field>

                <Field>
                  <div className="flex items-center justify-between">
                    <FieldLabel>NMS Threshold</FieldLabel>
                    <Badge variant="secondary" className="font-mono">
                      {((settings.nms_threshold as number) || 0.5).toFixed(2)}
                    </Badge>
                  </div>
                  <Slider
                    value={[(settings.nms_threshold as number) || 0.5]}
                    min={0.1}
                    max={0.95}
                    step={0.01}
                    onValueChange={(val) => updateSetting('nms_threshold', Array.isArray(val) ? val[0] : val)}
                  />
                  <FieldDescription>
                    Non-Maximum Suppression to reduce overlapping boxes
                  </FieldDescription>
                </Field>
              </div>

              {/* Number Inputs */}
              <FieldSet className="grid gap-4 sm:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="process_frames">Process Every N Frames</FieldLabel>
                  <Input
                    id="process_frames"
                    type="number"
                    min={1}
                    max={30}
                    value={(settings.process_every_n_frames as number) || 5}
                    onChange={(e) => updateSetting('process_every_n_frames', parseInt(e.target.value) || 5)}
                    className="font-mono"
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="inference_size">Inference Size (px)</FieldLabel>
                  <Input
                    id="inference_size"
                    type="number"
                    min={320}
                    max={1280}
                    step={32}
                    value={(settings.inference_size as number) || 640}
                    onChange={(e) => updateSetting('inference_size', parseInt(e.target.value) || 640)}
                    className="font-mono"
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="target_classes">Target Class IDs</FieldLabel>
                  <Input
                    id="target_classes"
                    value={((settings.target_class_ids as number[]) || [0]).join(', ')}
                    onChange={(e) => updateSetting('target_class_ids', 
                      e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
                    )}
                    placeholder="0, 1, 2..."
                    className="font-mono"
                  />
                  <FieldDescription>Comma-separated class IDs</FieldDescription>
                </Field>
              </FieldSet>
            </FieldGroup>
          </CardContent>
        </Card>

        {/* Evidence Settings */}
        {isPluginEnabled('evidence_capture') && (
          <Card className="border-border/50">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                  <FileImageIcon className="size-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Evidence Settings</CardTitle>
                  <CardDescription>Configure captured evidence quality</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="evidence_width">Max Width (px)</FieldLabel>
                  <Input
                    id="evidence_width"
                    type="number"
                    min={320}
                    max={1920}
                    value={(settings.evidence_max_width as number) || 1280}
                    onChange={(e) => updateSetting('evidence_max_width', parseInt(e.target.value) || 1280)}
                    className="font-mono"
                  />
                  <FieldDescription>Maximum width for evidence images</FieldDescription>
                </Field>

                <Field>
                  <div className="flex items-center justify-between">
                    <FieldLabel>JPEG Quality</FieldLabel>
                    <Badge variant="secondary" className="font-mono">
                      {(settings.evidence_jpeg_quality as number) || 75}%
                    </Badge>
                  </div>
                  <Slider
                    value={[(settings.evidence_jpeg_quality as number) || 75]}
                    min={50}
                    max={95}
                    step={5}
                    onValueChange={(val) => updateSetting('evidence_jpeg_quality', Array.isArray(val) ? val[0] : val)}
                  />
                  <FieldDescription>Higher quality = larger file size</FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        )}

        {/* Save Button */}
        <div className="flex justify-end gap-3">
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

      {/* Sidebar with live status */}
      <div className="flex flex-col gap-4">
        <CameraLiveStatus 
          cameraId={cameraId} 
          hardwareDeviceId={hardwareDeviceId}
        />
      </div>
    </div>
  )
}
