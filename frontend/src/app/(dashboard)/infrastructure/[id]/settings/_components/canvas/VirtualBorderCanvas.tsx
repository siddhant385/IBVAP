'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { useToastManager } from '@/components/ui/toast'
import { createClient } from '@/utils/supabase/client'
import type { Json } from '@/types/database.types'
import { 
  TrashIcon, 
  FloppyDiskIcon, 
  ArrowCounterClockwiseIcon, 
  CheckIcon,
  CloudSlashIcon
} from '@phosphor-icons/react/dist/ssr'
import { DrawingCanvas, useSnapshot } from './DrawingCanvas'

export interface BorderPoint {
  x: number
  y: number
}

interface VirtualBorderCanvasProps {
  cameraId: string
  hardwareDeviceId?: string
  hardwareCameraId?: string
  initialBorderLine?: Array<[number, number]> | null
  onSave?: (borderLine: Array<[number, number]> | null) => void | Promise<void>
  isOffline?: boolean
}

/**
 * Canvas for drawing virtual border lines.
 * Uses shared DrawingCanvas + useSnapshot hooks for consistent behavior.
 */
export function VirtualBorderCanvas({
  cameraId,
  hardwareDeviceId,
  hardwareCameraId,
  initialBorderLine = null,
  onSave,
  isOffline = false
}: VirtualBorderCanvasProps) {
  const supabase = createClient()
  const toast = useToastManager()
  
  // Parse initial border line
  const parseInitialBorderLine = (): BorderPoint[] | null => {
    if (!initialBorderLine || initialBorderLine.length !== 2) return null
    return [
      { x: initialBorderLine[0][0], y: initialBorderLine[0][1] },
      { x: initialBorderLine[1][0], y: initialBorderLine[1][1] }
    ]
  }

  const [borderPoints, setBorderPoints] = useState<BorderPoint[] | null>(parseInitialBorderLine())
  const [currentPoints, setCurrentPoints] = useState<BorderPoint[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const { snapshotStatus, isRequestingSnapshot, requestSnapshot } = useSnapshot({
    hardwareDeviceId,
    hardwareCameraId,
    isOffline
  })

  // Draw scene
  const drawScene = useCallback((
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) => {
    if (borderPoints && borderPoints.length === 2) {
      drawBorderLine(ctx, borderPoints, width, height, '#f59e0b', false)
    }
    if (currentPoints.length > 0) {
      drawBorderLine(ctx, currentPoints, width, height, '#3b82f6', true)
    }
  }, [borderPoints, currentPoints])

  const handleCanvasClick = (x: number, y: number) => {
    if (!isDrawing) {
      setIsDrawing(true)
      setCurrentPoints([{ x, y }])
    } else if (currentPoints.length === 1) {
      setCurrentPoints([...currentPoints, { x, y }])
    }
  }

  const handleFinishLine = () => {
    if (currentPoints.length === 2) {
      setBorderPoints(currentPoints)
      setCurrentPoints([])
      setIsDrawing(false)
    }
  }

  const handleClearLine = () => {
    setBorderPoints(null)
    setCurrentPoints([])
    setIsDrawing(false)
  }

  const handleResetCurrent = () => {
    setCurrentPoints([])
    setIsDrawing(false)
  }

  const handleSaveSettings = async () => {
    if (!borderPoints || borderPoints.length !== 2) {
      toast.add({ title: 'Warning', description: 'Draw a border line before saving' })
      return
    }

    setIsSaving(true)
    
    try {
      const borderLineData: Array<[number, number]> = [
        [borderPoints[0].x, borderPoints[0].y],
        [borderPoints[1].x, borderPoints[1].y]
      ]

      if (onSave) {
        await onSave(borderLineData)
        toast.add({ title: 'Line Saved', description: 'Border line configured' })
      } else {
        const { data: existing } = await supabase
          .from('camera_settings')
          .select('id, settings')
          .eq('camera_id', cameraId)
          .maybeSingle()

        const currentSettings = (existing?.settings as Record<string, unknown>) || {}

        const payload: Json = {
          ...currentSettings,
          virtual_border_line: borderLineData
        }

        const { error } = await supabase
          .from('camera_settings')
          .upsert({
            camera_id: cameraId,
            settings: payload,
            version: crypto.randomUUID()
          }, { onConflict: 'camera_id' })

        if (error) throw error
        toast.add({ title: 'Saved', description: 'Border line pushed to edge device' })
      }
    } catch (error) {
      console.error('Save error:', error)
      toast.add({ title: 'Error', description: 'Failed to save border line' })
    } finally {
      setIsSaving(false)
    }
  }

  // Overlays
  const overlays = (
    <>
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        {currentPoints.length === 2 && (
          <Button size="sm" variant="secondary" onClick={handleFinishLine} className="shadow-lg">
            <CheckIcon className="size-4" />
            Confirm Line
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
        hardwareDeviceId={hardwareDeviceId}
        hardwareCameraId={hardwareCameraId}
        isOffline={isOffline}
        onDraw={drawScene}
        onCanvasClick={handleCanvasClick}
        overlays={overlays}
      />

      {/* Bottom controls */}
      <div className="flex items-center justify-between p-4 bg-muted/50 border-t">
        <div className="flex items-center gap-4">
          {borderPoints && borderPoints.length === 2 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Border line:</span>
              <span className="inline-flex items-center gap-1 text-xs bg-amber-500/10 text-amber-600 px-2 py-1 rounded-full">
                A → B
                <button 
                  onClick={handleClearLine}
                  className="hover:text-amber-800"
                >
                  ×
                </button>
              </span>
            </div>
          )}
          {isDrawing && (
            <span className="text-xs text-muted-foreground">
              {currentPoints.length === 0 
                ? 'Click to place point A (start)'
                : 'Click to place point B (end)'
              }
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={handleResetCurrent}
            disabled={!isDrawing && currentPoints.length === 0}
          >
            <ArrowCounterClockwiseIcon className="size-4" />
            Reset
          </Button>
          <Button 
            size="sm" 
            onClick={handleSaveSettings}
            disabled={isSaving || !borderPoints}
          >
            <FloppyDiskIcon className="size-4" />
            {isSaving ? 'Saving...' : 'Apply Line'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// Pure draw function
function drawBorderLine(
  ctx: CanvasRenderingContext2D,
  points: BorderPoint[],
  width: number,
  height: number,
  color: string,
  isDraft: boolean = false
) {
  if (points.length === 0) return

  ctx.beginPath()
  ctx.moveTo(points[0].x * width, points[0].y * height)
  
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x * width, points[i].y * height)
  }

  ctx.strokeStyle = color
  ctx.lineWidth = isDraft ? 2 : 4
  ctx.setLineDash(isDraft ? [8, 4] : [])
  ctx.stroke()
  ctx.setLineDash([])

  // Draw endpoint markers
  points.forEach((p, index) => {
    const px = p.x * width
    const py = p.y * height
    
    ctx.beginPath()
    ctx.arc(px, py, 10, 0, Math.PI * 2)
    ctx.fillStyle = index === 0 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(59, 130, 246, 0.3)'
    ctx.fill()
    
    ctx.beginPath()
    ctx.arc(px, py, 6, 0, Math.PI * 2)
    ctx.fillStyle = index === 0 ? '#22c55e' : '#3b82f6'
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.stroke()
    
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 10px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(index === 0 ? 'A' : 'B', px, py)
  })

  // Direction arrow
  if (!isDraft && points.length >= 2) {
    const startX = points[0].x * width
    const startY = points[0].y * height
    const endX = points[1].x * width
    const endY = points[1].y * height
    const midX = (startX + endX) / 2
    const midY = (startY + endY) / 2
    
    const angle = Math.atan2(endY - startY, endX - startX)
    const arrowSize = 12
    
    ctx.save()
    ctx.translate(midX, midY)
    ctx.rotate(angle)
    
    ctx.beginPath()
    ctx.moveTo(arrowSize, 0)
    ctx.lineTo(-arrowSize / 2, -arrowSize / 2)
    ctx.lineTo(-arrowSize / 2, arrowSize / 2)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
    
    ctx.restore()
  }
}
