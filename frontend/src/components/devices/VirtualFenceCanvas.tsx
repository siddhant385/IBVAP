'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Trash2, Save, Undo, Check } from 'lucide-react'
import { useToastManager } from '@/components/ui/toast'
import { createClient } from '@/utils/supabase/client'
import type { Json } from '@/types/database.types'

export interface Point {
  x: number
  y: number
}

export interface Polygon {
  id: string
  label: string
  points: Point[]
}

// Type for command result from edge device
interface CommandResult {
  image_url?: string
  error?: string
  [key: string]: unknown
}

// Snapshot request timeout in milliseconds
const SNAPSHOT_TIMEOUT_MS = 30000

interface VirtualFenceCanvasProps {
  deviceId?: string
  cameraId: string
  hardwareDeviceId?: string
  hardwareCameraId?: string
  initialPolygons?: Polygon[]
  referenceImageUrl?: string
  onSave?: (polygons: Polygon[]) => void | Promise<void>
  embedded?: boolean
}

export function VirtualFenceCanvas({ 
  deviceId,
  cameraId,
  hardwareDeviceId,
  hardwareCameraId,
  initialPolygons = [], 
  referenceImageUrl,
  onSave,
  embedded = false
}: VirtualFenceCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [polygons, setPolygons] = useState<Polygon[]>(initialPolygons)
  const [currentPolygon, setCurrentPolygon] = useState<Point[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  
  // Snapshot states
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(referenceImageUrl || null)
  const [isRequestingSnapshot, setIsRequestingSnapshot] = useState(false)
  const [snapshotStatus, setSnapshotStatus] = useState<string>('')
  
  // Save state
  const [isSaving, setIsSaving] = useState(false)
  
  const toast = useToastManager()
  const supabase = createClient()

  // Cleanup function reference for channel subscription
  const channelCleanupRef = useRef<(() => void) | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelCleanupRef.current) {
        channelCleanupRef.current()
      }
    }
  }, [])

  // Draw polygon on canvas
  const drawPolygon = useCallback((
    ctx: CanvasRenderingContext2D, 
    points: Point[], 
    width: number, 
    height: number, 
    fillColor: string, 
    strokeColor: string,
    closePath: boolean = true
  ) => {
    if (points.length === 0) return

    ctx.beginPath()
    ctx.moveTo(points[0].x * width, points[0].y * height)
    
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x * width, points[i].y * height)
    }

    if (closePath && points.length > 2) {
      ctx.closePath()
      ctx.fillStyle = fillColor
      ctx.fill()
    }

    ctx.strokeStyle = strokeColor
    ctx.lineWidth = 3
    ctx.stroke()

    // Draw vertex points with labels
    points.forEach((p, index) => {
      ctx.beginPath()
      ctx.arc(p.x * width, p.y * height, 6, 0, Math.PI * 2)
      ctx.fillStyle = strokeColor
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.stroke()
      
      // Draw point number
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 10px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText((index + 1).toString(), p.x * width, p.y * height)
    })
  }, [])

  // Main canvas drawing effect
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const drawCanvas = (img: HTMLImageElement | null) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      if (img) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      }

      // Draw saved polygons
      polygons.forEach((poly) => {
        drawPolygon(ctx, poly.points, canvas.width, canvas.height, 'rgba(239, 68, 68, 0.35)', '#ef4444')
      })

      // Draw current polygon being built
      if (currentPolygon.length > 0) {
        drawPolygon(ctx, currentPolygon, canvas.width, canvas.height, 'rgba(59, 130, 246, 0.35)', '#3b82f6', false)
      }
    }

    if (!snapshotUrl) {
      setImageLoaded(false)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      drawCanvas(null)
      return
    }

    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.src = snapshotUrl
    
    img.onload = () => {
      const ratio = img.width / img.height
      const containerWidth = container.clientWidth
      const scaledHeight = containerWidth / ratio

      canvas.width = containerWidth
      canvas.height = scaledHeight

      setImageLoaded(true)
      drawCanvas(img)
    }

    img.onerror = () => {
      setImageLoaded(false)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      drawCanvas(null)
    }
  }, [snapshotUrl, polygons, currentPolygon, drawPolygon])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imageLoaded) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    // Use display size for consistent coordinate mapping
    const displayWidth = rect.width
    const displayHeight = rect.height
    
    const x = (e.clientX - rect.left) / displayWidth
    const y = (e.clientY - rect.top) / displayHeight

    if (!isDrawing) {
      setIsDrawing(true)
      setCurrentPolygon([{ x, y }])
    } else {
      setCurrentPolygon([...currentPolygon, { x, y }])
    }
  }

  const handleFinishPolygon = () => {
    if (currentPolygon.length >= 3) {
      const newPolygon: Polygon = {
        id: crypto.randomUUID(),
        label: `Zone ${polygons.length + 1}`,
        points: currentPolygon
      }
      setPolygons([...polygons, newPolygon])
    }
    setCurrentPolygon([])
    setIsDrawing(false)
  }

  const handleRequestSnapshot = async () => {
    if (!hardwareDeviceId) {
      toast.add({ title: 'Error', description: 'Hardware Device ID is missing.' })
      return
    }

    setIsRequestingSnapshot(true)
    setSnapshotStatus('Requesting snapshot...')

    try {
      const { data, error: insertError } = await supabase
        .from('device_commands')
        .insert({
          device_id: hardwareDeviceId,
          camera_id: hardwareCameraId || null,
          command: 'snapshot',
          status: 'pending',
          payload: {}
        })
        .select()

      if (insertError) throw insertError
      
      const commandId = data?.[0]?.id
      if (!commandId) throw new Error('No command ID returned')

      const channel = supabase
        .channel(`command_${commandId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'device_commands',
            filter: `id=eq.${commandId}`
          },
          (payload) => {
            const updatedCommand = payload.new as { status: string; result: CommandResult }
            
            if (updatedCommand.status === 'completed') {
              cleanupChannel()
              const resultData = updatedCommand.result
              if (resultData?.image_url) {
                setSnapshotUrl(resultData.image_url)
                setSnapshotStatus('Snapshot ready')
                toast.add({ title: 'Success', description: 'Snapshot received' })
              } else {
                setSnapshotStatus('No image returned')
              }
              setIsRequestingSnapshot(false)
            } else if (updatedCommand.status === 'failed') {
              cleanupChannel()
              setSnapshotStatus('Snapshot failed')
              setIsRequestingSnapshot(false)
              toast.add({ title: 'Error', description: 'Snapshot failed on edge device' })
            }
          }
        )
        .subscribe()

      const cleanupChannel = () => {
        supabase.removeChannel(channel)
        channelCleanupRef.current = null
      }
      
      channelCleanupRef.current = cleanupChannel

      const timeoutId = setTimeout(() => {
        cleanupChannel()
        setIsRequestingSnapshot(false)
        setSnapshotStatus('Timeout - device may be offline')
        toast.add({ title: 'Timeout', description: 'Edge device did not respond' })
        supabase.from('device_commands').update({ status: 'timeout' }).eq('id', commandId).then()
      }, SNAPSHOT_TIMEOUT_MS)

      const originalCleanup = channelCleanupRef.current
      channelCleanupRef.current = () => {
        clearTimeout(timeoutId)
        if (originalCleanup) originalCleanup()
      }

    } catch (error) {
      console.error('Snapshot error:', error)
      setSnapshotStatus('Failed to request snapshot')
      setIsRequestingSnapshot(false)
      toast.add({ title: 'Error', description: 'Failed to request snapshot' })
    }
  }

  const handleSaveSettings = async () => {
    if (polygons.length === 0) {
      toast.add({ title: 'Warning', description: 'Draw at least one zone before saving' })
      return
    }

    setIsSaving(true)
    
    try {
      // If onSave callback provided, use it (embedded mode)
      if (onSave) {
        await onSave(polygons)
        toast.add({ title: 'Zone Saved', description: 'Intrusion zone configured' })
      } else {
        // Standalone mode - save directly to database
        const { data: existing } = await supabase
          .from('camera_settings')
          .select('id, settings')
          .eq('camera_id', cameraId)
          .maybeSingle()

        const currentSettings = (existing?.settings as Record<string, unknown>) || {}
        
        // Convert to backend format: [[x1,y1], [x2,y2], ...]
        const intrusionZonePolygon = polygons[0].points.map(p => [p.x, p.y])

        const payload: Json = {
          ...currentSettings,
          intrusion_zone_polygon: intrusionZonePolygon
        }

        const { error } = await supabase
          .from('camera_settings')
          .upsert({
            camera_id: cameraId,
            settings: payload,
            version: crypto.randomUUID()
          }, { onConflict: 'camera_id' })

        if (error) throw error

        toast.add({ title: 'Saved', description: 'Intrusion zone pushed to edge device' })
      }
    } catch (error) {
      console.error('Save error:', error)
      toast.add({ title: 'Error', description: 'Failed to save intrusion zone' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetCurrent = () => {
    setCurrentPolygon([])
    setIsDrawing(false)
  }

  const handleDeletePolygon = (id: string) => {
    setPolygons(polygons.filter(p => p.id !== id))
  }

  // Embedded mode - simplified UI
  if (embedded) {
    return (
      <div className="relative">
        {/* Canvas Controls Overlay */}
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          {isDrawing && currentPolygon.length >= 3 && (
            <Button size="sm" variant="secondary" onClick={handleFinishPolygon} className="shadow-lg">
              <Check className="h-4 w-4 mr-1" />
              Complete Zone
            </Button>
          )}
          <Button 
            size="sm" 
            variant="secondary" 
            onClick={handleRequestSnapshot} 
            disabled={isRequestingSnapshot}
            className="shadow-lg"
          >
            {isRequestingSnapshot ? 'Fetching...' : 'Fetch Snapshot'}
          </Button>
        </div>

        {/* Status Overlay */}
        {snapshotStatus && (
          <div className="absolute top-4 right-4 z-10">
            <span className={`text-xs px-2 py-1 rounded-full ${
              isRequestingSnapshot ? 'bg-amber-500/90 text-white animate-pulse' : 'bg-black/70 text-white'
            }`}>
              {snapshotStatus}
            </span>
          </div>
        )}

        {/* Canvas */}
        <div 
          ref={containerRef} 
          className="relative w-full cursor-crosshair bg-zinc-950 min-h-[350px] flex items-center justify-center"
        >
          {!imageLoaded && (
            <div className="text-zinc-500 flex flex-col items-center gap-2">
              {isRequestingSnapshot ? (
                <>
                  <div className="h-8 w-8 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
                  <span className="text-sm">Waiting for snapshot...</span>
                </>
              ) : (
                <span className="text-sm">Fetch a snapshot to start drawing</span>
              )}
            </div>
          )}
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="absolute top-0 left-0 w-full h-full object-contain"
          />
        </div>

        {/* Bottom Controls */}
        <div className="flex items-center justify-between p-4 bg-muted/50 border-t">
          <div className="flex items-center gap-4">
            {polygons.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Active zone:</span>
                {polygons.map(poly => (
                  <span 
                    key={poly.id}
                    className="inline-flex items-center gap-1 text-xs bg-red-500/10 text-red-600 px-2 py-1 rounded-full"
                  >
                    {poly.label}
                    <button 
                      onClick={() => handleDeletePolygon(poly.id)}
                      className="hover:text-red-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            {isDrawing && (
              <span className="text-xs text-muted-foreground">
                Click to add points ({currentPolygon.length} placed)
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={handleResetCurrent}
              disabled={!isDrawing && currentPolygon.length === 0}
            >
              <Undo className="h-4 w-4 mr-1" />
              Reset
            </Button>
            <Button 
              size="sm" 
              onClick={handleSaveSettings}
              disabled={isSaving || polygons.length === 0}
            >
              <Save className="h-4 w-4 mr-1" />
              {isSaving ? 'Saving...' : 'Apply Zone'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Standalone mode - full UI with sidebar
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 overflow-hidden rounded-xl border border-border/50">
        <div className="bg-muted/50 p-4 flex items-center justify-between border-b">
          <div>
            <h3 className="font-medium">Draw Intrusion Zone</h3>
            <p className="text-sm text-muted-foreground">Click to place polygon vertices</p>
          </div>
          <div className="flex gap-2">
            {isDrawing && currentPolygon.length >= 3 && (
              <Button size="sm" variant="secondary" onClick={handleFinishPolygon}>
                Complete Shape
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleRequestSnapshot} disabled={isRequestingSnapshot}>
              {isRequestingSnapshot ? 'Requesting...' : 'Fetch Snapshot'}
            </Button>
          </div>
        </div>
        
        <div 
          ref={containerRef} 
          className="relative w-full cursor-crosshair bg-zinc-950 min-h-[400px] flex items-center justify-center"
        >
          {!imageLoaded && (
            <div className="text-zinc-500 flex flex-col items-center">
              {isRequestingSnapshot ? (
                <span className="animate-pulse">Waiting for edge device...</span>
              ) : (
                <span>Fetch a snapshot to start drawing</span>
              )}
            </div>
          )}
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="absolute top-0 left-0 w-full h-full object-contain"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-border/50 p-4">
          <h4 className="font-medium mb-3">Configured Zones</h4>
          {polygons.length === 0 ? (
            <p className="text-sm text-muted-foreground">No zones configured yet.</p>
          ) : (
            <div className="space-y-2">
              {polygons.map((poly) => (
                <div key={poly.id} className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                  <span className="text-sm font-medium text-red-600">{poly.label}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeletePolygon(poly.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 mt-4 border-t flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={handleResetCurrent}
              disabled={!isDrawing && currentPolygon.length === 0}
            >
              <Undo className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button 
              className="flex-1"
              onClick={handleSaveSettings}
              disabled={isSaving || polygons.length === 0}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Push to Edge'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
