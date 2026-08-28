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
  initialPolygons = [], 
  referenceImageUrl 
}: { 
  deviceId: string
  cameraId: string
  initialPolygons?: Polygon[]
  referenceImageUrl: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [polygons, setPolygons] = useState<Polygon[]>(initialPolygons)
  const [currentPolygon, setCurrentPolygon] = useState<Point[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
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

    const drawCanvas = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, width: number, height: number) => {
      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)
  
      // Draw saved polygons
      polygons.forEach((poly) => {
        drawPolygon(ctx, poly.points, width, height, 'rgba(239, 68, 68, 0.4)', '#ef4444') // Alert Red
      })
  
      // Draw current polygon being built
      if (currentPolygon.length > 0) {
        drawPolygon(ctx, currentPolygon, width, height, 'rgba(59, 130, 246, 0.4)', '#3b82f6', !isDrawing)
        
        // Draw connection line to mouse if drawing
        if (isDrawing && currentPolygon.length > 0) {
          // We'd need mouse tracking for this, simplified for now
        }
      }
    }

    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.src = referenceImageUrl
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
  }, [referenceImageUrl, polygons, currentPolygon, isDrawing]) // Redraw when these change

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

  const handleSaveSettings = async () => {
    try {
      // 1. Check if record exists and fetch current settings
      const { data: existing } = await supabase
        .from('device_settings')
        .select('id, settings')
        .eq('device_id', deviceId)
        .single()

      const version = crypto.randomUUID()

      // Build the new polygons structure for the specific camera
      const cameraFences = polygons.map((polygon) => ({
        id: polygon.id,
        label: polygon.label,
        points: polygon.points.map((point) => ({
          x: point.x,
          y: point.y,
        })),
      }))

      // Merge with existing settings or create new root
      const currentSettings = (existing?.settings as Record<string, unknown>) || {}
      const currentCameras = (currentSettings.cameras as Record<string, unknown>) || {}
      const currentCameraSettings = (currentCameras[cameraId] as Record<string, unknown>) || {}

      const payload: Json = {
        ...currentSettings,
        cameras: {
          ...currentCameras,
          [cameraId]: {
            ...currentCameraSettings,
            virtual_fences: cameraFences
          }
        }
      }

      let error;
      if (existing) {
        const { error: updateError } = await supabase
          .from('device_settings')
          .update({
            settings: payload,
            version: version
          })
          .eq('device_id', deviceId)
        error = updateError
      } else {
        const { error: insertError } = await supabase
          .from('device_settings')
          .insert({
            device_id: deviceId,
            settings: payload,
            version: version
          })
        error = insertError
      }

      if (error) throw error
      
      toast.add({
        title: "Settings Saved",
        description: "Virtual fences pushed to edge device."
      })
    } catch (error) {
      console.error(error)
      toast.add({
        title: "Error",
        description: "Failed to push settings to edge."
      })
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2 overflow-hidden border-border/50">
        <CardHeader className="bg-muted/50 py-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Draw Region of Interest (ROI)</span>
            <div className="flex gap-2">
              {isDrawing && (
                <Button size="sm" variant="secondary" onClick={handleFinishPolygon}>
                  Complete Shape
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div 
            ref={containerRef} 
            className="relative w-full cursor-crosshair bg-black/90 min-h-[400px] flex items-center justify-center"
          >
            {!imageLoaded && <div className="text-muted-foreground animate-pulse">Loading camera feed...</div>}
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
