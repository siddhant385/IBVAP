'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useToastManager } from '@/components/ui/toast'
import { createClient } from '@/utils/supabase/client'
import type { Json } from '@/types/database.types'
import { 
  FloppyDiskIcon, 
  ArrowCounterClockwiseIcon, 
  CheckIcon,
  CloudSlashIcon
} from '@phosphor-icons/react/dist/ssr'
import { DrawingCanvas } from './DrawingCanvas'
import { useSnapshot } from '../hooks/useSnapshot'

export interface Point {
  x: number
  y: number
}

export interface Polygon {
  id: string
  label: string
  points: Point[]
}

interface VirtualFenceCanvasProps {
  cameraId: string
  hardwareDeviceId?: string
  hardwareCameraId?: string
  initialPolygons?: Polygon[]
  onSave?: (polygons: Polygon[]) => void | Promise<void>
  embedded?: boolean
  isOffline?: boolean
}

/**
 * Canvas for drawing intrusion detection polygons.
 * Uses shared DrawingCanvas + useSnapshot hooks for consistent behavior.
 */
export function VirtualFenceCanvas({ 
  cameraId,
  hardwareDeviceId,
  hardwareCameraId,
  initialPolygons = [], 
  onSave,
  isOffline = false
}: VirtualFenceCanvasProps) {
  const supabase = createClient()
  const toast = useToastManager()
  const [polygons, setPolygons] = useState<Polygon[]>(initialPolygons)
  const [currentPolygon, setCurrentPolygon] = useState<Point[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const { snapshotUrl, snapshotStatus, isRequestingSnapshot, requestSnapshot } = useSnapshot({
    hardwareDeviceId,
    hardwareCameraId,
    isOffline
  })

  useEffect(() => {
    if (isOffline) return
    if (snapshotUrl) return
    if (isRequestingSnapshot) return
    requestSnapshot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOffline, snapshotUrl, isRequestingSnapshot, hardwareDeviceId, hardwareCameraId])

  // Draw scene - renders all polygons
  const drawScene = useCallback((
    ctx: CanvasRenderingContext2D, 
    width: number, 
    height: number
  ) => {
    polygons.forEach((poly) => {
      drawPolygon(ctx, poly.points, width, height, 'rgba(239, 68, 68, 0.35)', '#ef4444', true)
    })
    if (currentPolygon.length > 0) {
      drawPolygon(ctx, currentPolygon, width, height, 'rgba(59, 130, 246, 0.35)', '#3b82f6', false)
    }
  }, [polygons, currentPolygon])

  const handleCanvasClick = (x: number, y: number) => {
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

  const handleResetCurrent = () => {
    setCurrentPolygon([])
    setIsDrawing(false)
  }

  const handleDeletePolygon = (id: string) => {
    setPolygons(polygons.filter(p => p.id !== id))
  }

  const handleSaveSettings = async () => {
    if (polygons.length === 0) {
      toast.add({ title: 'Warning', description: 'Draw at least one zone before saving' })
      return
    }

    setIsSaving(true)
    
    try {
      if (onSave) {
        await onSave(polygons)
        toast.add({ title: 'Zone Saved', description: 'Intrusion zone configured' })
      } else {
        const { data: existing } = await supabase
          .from('camera_settings')
          .select('id, settings')
          .eq('camera_id', cameraId)
          .maybeSingle()

        const currentSettings = (existing?.settings as Record<string, unknown>) || {}
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

  // Overlays (top buttons + status)
  const overlays = (
    <>
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        {isDrawing && currentPolygon.length >= 3 && (
          <Button size="sm" variant="secondary" onClick={handleFinishPolygon} className="shadow-lg">
            <CheckIcon className="size-4" />
            Complete Zone
          </Button>
        )}
        <Button 
          size="sm" 
          variant="secondary" 
          onClick={requestSnapshot} 
          disabled={isRequestingSnapshot || isOffline}
          className="shadow-lg"
        >
          {isOffline ? (
            <>
              <CloudSlashIcon className="size-4" />
              Offline
            </>
          ) : isRequestingSnapshot ? 'Fetching...' : 'Fetch Snapshot'}
        </Button>
      </div>
      {snapshotStatus && (
        <div className="absolute top-4 right-4 z-10">
          <span className={`text-xs px-2 py-1 rounded-full ${
            isRequestingSnapshot ? 'bg-amber-500/90 text-white animate-pulse' : 'bg-black/70 text-white'
          }`}>
            {snapshotStatus}
          </span>
        </div>
      )}
    </>
  )

  return (
    <div className="relative">
      <DrawingCanvas
        isOffline={isOffline}
        snapshotUrl={snapshotUrl}
        isRequestingSnapshot={isRequestingSnapshot}
        onDraw={drawScene}
        onCanvasClick={handleCanvasClick}
        overlays={overlays}
      />
      
      {/* Bottom controls */}
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
            <ArrowCounterClockwiseIcon className="size-4" />
            Reset
          </Button>
          <Button 
            size="sm" 
            onClick={handleSaveSettings}
            disabled={isSaving || polygons.length === 0}
          >
            <FloppyDiskIcon className="size-4" />
            {isSaving ? 'Saving...' : 'Apply Zone'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// Pure draw function (testable, no React)
function drawPolygon(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  width: number,
  height: number,
  fillColor: string,
  strokeColor: string,
  closePath: boolean = true
) {
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

  points.forEach((p, index) => {
    ctx.beginPath()
    ctx.arc(p.x * width, p.y * height, 6, 0, Math.PI * 2)
    ctx.fillStyle = strokeColor
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.stroke()
    
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 10px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText((index + 1).toString(), p.x * width, p.y * height)
  })
}
