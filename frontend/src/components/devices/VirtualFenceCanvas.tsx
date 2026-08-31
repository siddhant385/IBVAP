'use client'

import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trash2, Save, Undo } from 'lucide-react'
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

export function VirtualFenceCanvas({ 
  deviceId,
  cameraId,
  hardwareDeviceId,
  hardwareCameraId,
  initialPolygons = [], 
  referenceImageUrl 
}: { 
  deviceId?: string
  cameraId: string
  hardwareDeviceId?: string
  hardwareCameraId?: string
  initialPolygons?: Polygon[]
  referenceImageUrl?: string
}) {
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
  
  const toast = useToastManager()
  const supabase = createClient()

  useEffect(() => {
    const drawPolygon = (
      ctx: CanvasRenderingContext2D, 
      points: Point[], 
      width: number, 
      height: number, 
      fillColor: string, 
      strokeColor: string,
      closePath = true
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
      ctx.lineWidth = 2
      ctx.stroke()
  
      // Draw vertex points
      points.forEach((p) => {
        ctx.beginPath()
        ctx.arc(p.x * width, p.y * height, 4, 0, Math.PI * 2)
        ctx.fillStyle = strokeColor
        ctx.fill()
      })
    }

    const drawCanvas = (ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, width: number, height: number) => {
      ctx.clearRect(0, 0, width, height)
      if (img) {
         ctx.drawImage(img, 0, 0, width, height)
      }
  
      // Draw saved polygons
      polygons.forEach((poly) => {
        drawPolygon(ctx, poly.points, width, height, 'rgba(239, 68, 68, 0.4)', '#ef4444') // Alert Red
      })
  
      // Draw current polygon being built
      if (currentPolygon.length > 0) {
        drawPolygon(ctx, currentPolygon, width, height, 'rgba(59, 130, 246, 0.4)', '#3b82f6', !isDrawing)
      }
    }

    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (!snapshotUrl) {
      setImageLoaded(false)
      // clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      drawCanvas(ctx, null, canvas.width, canvas.height)
      return
    }

    const img = new Image()
    img.crossOrigin = "Anonymous"
    img.src = snapshotUrl
    img.onload = () => {
      // Scale canvas to fit container while maintaining aspect ratio
      const ratio = img.width / img.height
      const containerWidth = container.clientWidth
      const scaledHeight = containerWidth / ratio

      canvas.width = containerWidth
      canvas.height = scaledHeight
      
      setImageLoaded(true)
      drawCanvas(ctx, img, canvas.width, canvas.height)
    }
    img.onerror = () => {
       setImageLoaded(false)
       ctx.clearRect(0, 0, canvas.width, canvas.height)
       drawCanvas(ctx, null, canvas.width, canvas.height)
    }
  }, [snapshotUrl, polygons, currentPolygon, isDrawing]) // Redraw when these change

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imageLoaded) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    // Store normalized coordinates (0.0 to 1.0)
    const x = (e.clientX - rect.left) / canvas.width
    const y = (e.clientY - rect.top) / canvas.height

    if (!isDrawing) {
      setIsDrawing(true)
      setCurrentPolygon([{ x, y }])
    } else {
      setCurrentPolygon([...currentPolygon, { x, y }])
    }
  }

  const handleFinishPolygon = () => {
    if (currentPolygon.length > 2) {
      setPolygons([
        ...polygons, 
        { 
          id: crypto.randomUUID(), 
          label: `Zone ${polygons.length + 1}`, 
          points: currentPolygon 
        }
      ])
    }
    setCurrentPolygon([])
    setIsDrawing(false)
  }

  const handleRequestSnapshot = async () => {
    if (!hardwareDeviceId) {
      toast.add({ title: "Error", description: "Hardware Device ID is missing." })
      return
    }

    setIsRequestingSnapshot(true)
    setSnapshotStatus('Requesting snapshot from edge device...')

    try {
      // 1. Insert command into device_commands
      const commandId = crypto.randomUUID()
      const { error: insertError } = await supabase
        .from('device_commands')
        .insert({
          id: commandId,
          device_id: hardwareDeviceId,
          camera_id: hardwareCameraId || null,
          command: 'snapshot',
          status: 'pending',
          payload: {}
        })

      if (insertError) throw insertError

      // 2. Listen for changes to this specific command
      let timeoutId: NodeJS.Timeout

      const channel = supabase
        .channel(`command_${commandId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'device_commands',
            filter: `id=eq.${commandId}`,
          },
          (payload) => {
            const updatedCommand = payload.new
            if (updatedCommand.status === 'completed') {
              clearTimeout(timeoutId)
              supabase.removeChannel(channel)
              
              // Extract image from result (assuming result.image_url or result.data)
              const resultData = updatedCommand.result as any
              if (resultData && resultData.image_url) {
                setSnapshotUrl(resultData.image_url)
                setSnapshotStatus('Snapshot received.')
                toast.add({ title: "Success", description: "Snapshot updated." })
              } else {
                setSnapshotStatus('Snapshot completed but no image URL was found.')
                toast.add({ title: "Warning", description: "No image data returned." })
              }
              setIsRequestingSnapshot(false)
            } else if (updatedCommand.status === 'failed') {
              clearTimeout(timeoutId)
              supabase.removeChannel(channel)
              setSnapshotStatus('Edge device failed to take snapshot.')
              setIsRequestingSnapshot(false)
              toast.add({ title: "Error", description: "Snapshot failed on edge." })
            }
          }
        )
        .subscribe()

      // 3. Set a timeout in case the edge device is offline
      timeoutId = setTimeout(() => {
        supabase.removeChannel(channel)
        setIsRequestingSnapshot(false)
        setSnapshotStatus('Snapshot request timed out (Edge device might be offline).')
        toast.add({ title: "Timeout", description: "Edge device did not respond in time." })
        
        // Optionally update the row to 'failed' or 'timeout'
        supabase.from('device_commands').update({ status: 'timeout' }).eq('id', commandId).then()
      }, 30000) // 30 seconds

    } catch (error) {
      console.error(error)
      setSnapshotStatus('Failed to send command.')
      setIsRequestingSnapshot(false)
      toast.add({ title: "Error", description: "Failed to request snapshot." })
    }
  }

  const handleSaveSettings = async () => {
    try {
      // Fetch current camera settings
      const { data: existing } = await supabase
        .from('camera_settings')
        .select('id, settings')
        .eq('camera_id', cameraId)
        .single()

      const version = crypto.randomUUID()

      // Build the new polygons structure
      const cameraFences = polygons.map((polygon) => ({
        id: polygon.id,
        label: polygon.label,
        points: polygon.points.map((point) => ({
          x: point.x,
          y: point.y,
        })),
      }))

      // Merge with existing settings
      const currentSettings = (existing?.settings as Record<string, unknown>) || {}

      const payload: Json = {
        ...(currentSettings as Record<string, Json>),
        virtual_fences: cameraFences as unknown as Json
      }

      const { error } = await supabase
        .from('camera_settings')
        .upsert({
          camera_id: cameraId,
          settings: payload,
          version: version
        }, { onConflict: 'camera_id' })

      if (error) throw error
      
      toast.add({
        title: "Zones Saved",
        description: "Virtual fences pushed to edge device."
      })
    } catch (error) {
      console.error(error)
      toast.add({
        title: "Error",
        description: "Failed to save virtual fences."
      })
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2 overflow-hidden border-border/50">
        <CardHeader className="bg-muted/50 py-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Draw Region of Interest (ROI)</span>
            <div className="flex gap-2 items-center">
              {isDrawing && (
                <Button size="sm" variant="secondary" onClick={handleFinishPolygon}>
                  Complete Shape
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={handleRequestSnapshot} disabled={isRequestingSnapshot}>
                {isRequestingSnapshot ? "Requesting..." : "Fetch Live Snapshot"}
              </Button>
            </div>
          </CardTitle>
          {snapshotStatus && (
            <CardDescription className={isRequestingSnapshot ? "animate-pulse" : ""}>
              {snapshotStatus}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div 
            ref={containerRef} 
            className="relative w-full cursor-crosshair bg-black/90 min-h-[400px] flex items-center justify-center"
          >
            {!imageLoaded && (
              <div className="text-muted-foreground flex flex-col items-center">
                {isRequestingSnapshot ? (
                  <span className="animate-pulse">Waiting for edge device...</span>
                ) : (
                  <span>No recent snapshot. Request one to start drawing.</span>
                )}
              </div>
            )}
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="absolute top-0 left-0 w-full h-full object-contain"
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Configured Zones</CardTitle>
            <CardDescription>Virtual fences currently active on the edge device.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {polygons.length === 0 ? (
              <div className="text-sm text-muted-foreground">No zones configured. Click on the image to draw a polygon.</div>
            ) : (
              <div className="space-y-2">
                {polygons.map((poly) => (
                  <div key={poly.id} className="flex items-center justify-between rounded-md border p-2 text-sm bg-background/50">
                    <span className="font-medium text-destructive">{poly.label}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setPolygons(polygons.filter(p => p.id !== poly.id))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-4 flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  setCurrentPolygon([])
                  setIsDrawing(false)
                }}
              >
                <Undo className="h-4 w-4 mr-2" />
                Reset Current
              </Button>
              <Button 
                className="flex-1"
                onClick={handleSaveSettings}
              >
                <Save className="h-4 w-4 mr-2" />
                Push to Edge
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
