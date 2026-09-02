'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { useToastManager } from '@/components/ui/toast'
import { createClient } from '@/utils/supabase/client'
import { 
  Save, 
  Eye, 
  Route, 
  ShieldAlert, 
  Camera, 
  Video, 
  FileImage,
  Zap,
  Target,
  Cog
} from 'lucide-react'
import { VirtualFenceCanvas, type Polygon } from './VirtualFenceCanvas'
import { VirtualBorderCanvas } from './VirtualBorderCanvas'

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
    icon: <Eye className="h-5 w-5" />,
    color: 'bg-blue-500/10 border-blue-500/50 text-blue-600',
    requiresConfig: false
  },
  {
    id: 'virtual_border',
    name: 'Virtual Border',
    description: 'Detect objects crossing a line boundary',
    icon: <Route className="h-5 w-5" />,
    color: 'bg-amber-500/10 border-amber-500/50 text-amber-600',
    requiresConfig: true
  },
  {
    id: 'intrusion_detection',
    name: 'Intrusion Detection',
    description: 'Detect objects entering a defined zone',
    icon: <ShieldAlert className="h-5 w-5" />,
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
    icon: <Video className="h-4 w-4" />
  },
  {
    id: 'evidence_capture',
    name: 'Evidence Capture',
    description: 'Save snapshots when events are detected',
    icon: <FileImage className="h-4 w-4" />
  }
]

// Type for settings
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
  const [settings, setSettings] = useState<CameraSettingsData>(initialSettings || {})
  const [isSaving, setIsSaving] = useState(false)
  const toast = useToastManager()
  const supabase = createClient()

  // Parse current detection mode from enabled plugins
  const getDetectionMode = useCallback((): DetectionMode => {
    const plugins = settings.enabled_plugins || []
    if (plugins.includes('intrusion_detection')) return 'intrusion_detection'
    if (plugins.includes('virtual_border')) return 'virtual_border'
    return 'object_detection'
  }, [settings.enabled_plugins])

  const [detectionMode, setDetectionMode] = useState<DetectionMode>(getDetectionMode())

  // Check if additional plugins are enabled
  const isPluginEnabled = (pluginId: string): boolean => {
    return (settings.enabled_plugins || []).includes(pluginId)
  }

  // Handle detection mode change
  const handleDetectionModeChange = (mode: DetectionMode) => {
    setDetectionMode(mode)
    
    // Update enabled_plugins with mutual exclusivity
    const currentPlugins = settings.enabled_plugins || []
    const additionalPlugins = currentPlugins.filter(p => 
      p === 'object_tracking' || p === 'evidence_capture'
    )
    
    let newPlugins: string[] = [mode, ...additionalPlugins]
    
    // Auto-enable evidence_capture for detection modes that benefit from it
    if ((mode === 'virtual_border' || mode === 'intrusion_detection') && 
        !additionalPlugins.includes('evidence_capture')) {
      newPlugins.push('evidence_capture')
    }
    
    setSettings(prev => ({ ...prev, enabled_plugins: newPlugins }))
  }

  // Toggle additional plugin
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

  // Update individual setting
  const updateSetting = (key: string, value: string | number | boolean | number[]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  // Handle polygon save (intrusion zone)
  const handlePolygonSave = async (polygons: Polygon[]) => {
    // Convert polygons to backend format: [[x1,y1], [x2,y2], [x3,y3], ...]
    // For now, we use the first polygon's points
    if (polygons.length > 0 && polygons[0].points.length >= 3) {
      const polygonPoints: Array<[number, number]> = polygons[0].points.map(p => [p.x, p.y])
      setSettings(prev => ({ ...prev, intrusion_zone_polygon: polygonPoints }))
    } else {
      setSettings(prev => ({ ...prev, intrusion_zone_polygon: [] }))
    }
  }

  // Handle border line save
  const handleBorderLineSave = async (borderLine: Array<[number, number]> | null) => {
    setSettings(prev => ({ ...prev, virtual_border_line: borderLine }))
  }

  // Save all settings to database
  const handleSave = async () => {
    setIsSaving(true)
    
    try {
      // Validate: if detection mode requires config, check it exists
      if (detectionMode === 'intrusion_detection') {
        const polygon = settings.intrusion_zone_polygon
        if (!polygon || polygon.length < 3) {
          toast.add({ 
            title: 'Configuration Required', 
            description: 'Please draw an intrusion zone polygon before saving.',
            type: 'error'
          })
          setIsSaving(false)
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
          setIsSaving(false)
          return
        }
      }

      const payload = {
        ...settings,
        // Ensure proper types
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

      toast.add({ 
        title: 'Settings Saved', 
        description: 'Camera configuration has been pushed to the edge device.' 
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

  return (
    <div className="space-y-6">
      {/* Detection Mode Selection */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Detection Mode</CardTitle>
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
                className={`relative flex flex-col items-start gap-3 p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                  detectionMode === mode.id
                    ? mode.color + ' border-current shadow-sm'
                    : 'bg-muted/30 border-border/50 hover:bg-muted/50 hover:border-border'
                }`}
              >
                <div className={`p-2 rounded-lg ${
                  detectionMode === mode.id ? 'bg-current/10' : 'bg-muted'
                }`}>
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
                  <p className="text-xs text-muted-foreground mt-1">{mode.description}</p>
                </div>
                {detectionMode === mode.id && (
                  <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-current" />
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
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-500/10">
                {detectionMode === 'intrusion_detection' 
                  ? <ShieldAlert className="h-5 w-5 text-red-500" />
                  : <Route className="h-5 w-5 text-amber-500" />
                }
              </div>
              <div>
                <CardTitle className="text-lg">
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
                embedded={true}
              />
            ) : (
              <VirtualBorderCanvas
                cameraId={cameraId}
                hardwareDeviceId={hardwareDeviceId}
                hardwareCameraId={hardwareCameraId}
                initialBorderLine={settings.virtual_border_line}
                onSave={handleBorderLineSave}
                embedded={true}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Additional Plugins */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Additional Features</CardTitle>
              <CardDescription>Optional enhancements for detection</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {ADDITIONAL_PLUGINS.map((plugin) => (
              <div
                key={plugin.id}
                className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ${
                  isPluginEnabled(plugin.id)
                    ? 'bg-primary/5 border-primary/30'
                    : 'bg-muted/30 border-border/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    isPluginEnabled(plugin.id) ? 'bg-primary/10' : 'bg-muted'
                  }`}>
                    <span className={isPluginEnabled(plugin.id) ? 'text-primary' : 'text-muted-foreground'}>
                      {plugin.icon}
                    </span>
                  </div>
                  <div>
                    <Label htmlFor={plugin.id} className="font-medium cursor-pointer">
                      {plugin.name}
                    </Label>
                    <p className="text-xs text-muted-foreground">{plugin.description}</p>
                  </div>
                </div>
                <Switch
                  id={plugin.id}
                  checked={isPluginEnabled(plugin.id)}
                  onCheckedChange={() => toggleAdditionalPlugin(plugin.id)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Inference Settings */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Cog className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Inference Settings</CardTitle>
              <CardDescription>Fine-tune model parameters</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sliders */}
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Confidence Threshold</Label>
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
                className="py-2"
              />
              <p className="text-xs text-muted-foreground">
                Minimum confidence score to register a detection
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">NMS Threshold</Label>
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
                className="py-2"
              />
              <p className="text-xs text-muted-foreground">
                Non-Maximum Suppression to reduce overlapping boxes
              </p>
            </div>
          </div>

          {/* Number Inputs */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="process_frames" className="text-sm font-medium">
                Process Every N Frames
              </Label>
              <Input
                id="process_frames"
                type="number"
                min={1}
                max={30}
                value={(settings.process_every_n_frames as number) || 5}
                onChange={(e) => updateSetting('process_every_n_frames', parseInt(e.target.value) || 5)}
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inference_size" className="text-sm font-medium">
                Inference Size (px)
              </Label>
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="target_classes" className="text-sm font-medium">
                Target Class IDs
              </Label>
              <Input
                id="target_classes"
                value={((settings.target_class_ids as number[]) || [0]).join(', ')}
                onChange={(e) => updateSetting('target_class_ids', 
                  e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
                )}
                placeholder="0, 1, 2..."
                className="font-mono"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Evidence Settings */}
      {isPluginEnabled('evidence_capture') && (
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileImage className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Evidence Settings</CardTitle>
                <CardDescription>Configure captured evidence quality</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="evidence_width" className="text-sm font-medium">
                  Max Width (px)
                </Label>
                <Input
                  id="evidence_width"
                  type="number"
                  min={320}
                  max={1920}
                  value={(settings.evidence_max_width as number) || 1280}
                  onChange={(e) => updateSetting('evidence_max_width', parseInt(e.target.value) || 1280)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum width for evidence images
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">JPEG Quality</Label>
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
                  className="py-2"
                />
                <p className="text-xs text-muted-foreground">
                  Higher quality = larger file size
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      <div className="flex justify-end gap-3 pt-2">
        <Button
          size="lg"
          onClick={handleSave}
          disabled={isSaving}
          className="min-w-[160px]"
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Push to Edge'}
        </Button>
      </div>
    </div>
  )
}
