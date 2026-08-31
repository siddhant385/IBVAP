'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { useToastManager } from '@/components/ui/toast'
import { createClient } from '@/utils/supabase/client'
import { Save } from 'lucide-react'

export function CameraSettingsForm({ cameraId, initialSettings }: { cameraId: string, initialSettings: Record<string, unknown> }) {
  const [settings, setSettings] = useState<Record<string, unknown>>(initialSettings || {})
  const [isSaving, setIsSaving] = useState(false)
  const toast = useToastManager()
  const supabase = createClient()

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('camera_settings')
        .upsert({
          camera_id: cameraId,
          settings,
          version: crypto.randomUUID()
        }, { onConflict: 'camera_id' })

      if (error) throw error
      toast.add({ title: "Settings Saved", description: "Camera analysis settings have been updated." })
    } catch (error) {
      console.error(error)
      toast.add({ title: "Error", description: "Failed to save camera settings." })
    } finally {
      setIsSaving(false)
    }
  }

  const updateSetting = (key: string, value: string | number | boolean | string[]) => {
    setSettings((prev: Record<string, unknown>) => ({ ...prev, [key]: value }))
  }

  const togglePlugin = (plugin: string) => {
    setSettings((prev: Record<string, unknown>) => {
      const current = (prev.enabled_plugins as string[]) || []
      if (current.includes(plugin)) {
        return { ...prev, enabled_plugins: current.filter((p: string) => p !== plugin) }
      } else {
        return { ...prev, enabled_plugins: [...current, plugin] }
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analysis Settings</CardTitle>
        <CardDescription>Configure inference, tracking, and plugin parameters for this specific camera.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="source">Stream Source URL</Label>
            <Input 
              id="source" 
              value={(settings.source as string) || ''} 
              onChange={(e) => updateSetting('source', e.target.value)} 
              placeholder="rtsp://..."
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2 pt-4">
            <div className="space-y-4 border p-4 rounded-lg bg-card/50">
              <Label className="flex justify-between items-center">
                <span>Confidence Threshold</span>
                <span className="text-muted-foreground text-xs bg-muted px-2 py-1 rounded">{(settings.confidence_threshold as number) || 0.45}</span>
              </Label>
              <Slider
                value={[(settings.confidence_threshold as number) || 0.45]}
                min={0.1} max={0.99} step={0.01}
                onValueChange={(val) => updateSetting('confidence_threshold', Array.isArray(val) ? val[0] : val as unknown as number)}
              />
              <p className="text-xs text-muted-foreground">Minimum certainty required to register a detection.</p>
            </div>
            <div className="space-y-4 border p-4 rounded-lg bg-card/50">
              <Label className="flex justify-between items-center">
                <span>NMS Threshold</span>
                <span className="text-muted-foreground text-xs bg-muted px-2 py-1 rounded">{(settings.nms_threshold as number) || 0.5}</span>
              </Label>
              <Slider
                value={[(settings.nms_threshold as number) || 0.5]}
                min={0.1} max={0.99} step={0.01}
                onValueChange={(val) => updateSetting('nms_threshold', Array.isArray(val) ? val[0] : val as unknown as number)}
              />
              <p className="text-xs text-muted-foreground">Non-Maximum Suppression (avoids overlapping bounding boxes).</p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="inference_size">Inference Size (px)</Label>
              <Input
                id="inference_size" type="number"
                value={(settings.inference_size as number) || 640}
                onChange={(e) => updateSetting('inference_size', parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="process_every_n_frames">Process Every N Frames</Label>
              <Input
                id="process_every_n_frames" type="number"
                value={(settings.process_every_n_frames as number) || 5}
                onChange={(e) => updateSetting('process_every_n_frames', parseInt(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <div>
              <Label className="text-base">Active Processing Plugins</Label>
              <p className="text-sm text-muted-foreground mb-4">Toggle which models run on this camera feed.</p>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="plugin-object" className="text-base">Object Detection</Label>
                  <p className="text-xs text-muted-foreground">Base YOLOv8 detection.</p>
                </div>
                <Switch
                  id="plugin-object"
                  checked={((settings.enabled_plugins as string[]) || []).includes('object_detection')}
                  onCheckedChange={() => togglePlugin('object_detection')}
                />
              </div>
              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="plugin-evidence" className="text-base">Evidence Capture</Label>
                  <p className="text-xs text-muted-foreground">Save snapshots of events.</p>
                </div>
                <Switch
                  id="plugin-evidence"
                  checked={((settings.enabled_plugins as string[]) || []).includes('evidence_capture')}
                  onCheckedChange={() => togglePlugin('evidence_capture')}
                />
              </div>
              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="plugin-anpr" className="text-base">ANPR / LPR</Label>
                  <p className="text-xs text-muted-foreground">License plate recognition.</p>
                </div>
                <Switch
                  id="plugin-anpr"
                  checked={((settings.enabled_plugins as string[]) || []).includes('anpr')}
                  onCheckedChange={() => togglePlugin('anpr')}
                />
              </div>
              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="plugin-face" className="text-base">Face Recognition</Label>
                  <p className="text-xs text-muted-foreground">Identify known subjects.</p>
                </div>
                <Switch
                  id="plugin-face"
                  checked={((settings.enabled_plugins as string[]) || []).includes('face_recognition')}
                  onCheckedChange={() => togglePlugin('face_recognition')}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 flex justify-end border-t">
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving to Edge..." : "Save Configuration"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
