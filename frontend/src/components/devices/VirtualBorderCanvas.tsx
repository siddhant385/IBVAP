'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Trash2, Save, Undo, Check } from 'lucide-react'
import { useToastManager } from '@/components/ui/toast'
import { createClient } from '@/utils/supabase/client'
import type { Json } from '@/types/database.types'

// Type for border line point
export interface BorderPoint {
  x: number
  y: number
}

// Type for command result from edge device
interface CommandResult {
  image_url?: string
  error?: string
  [key: string]: unknown
}

// Snapshot request timeout in milliseconds
const SNAPSHOT_TIMEOUT_MS = 30000

interface VirtualBorderCanvasProps {
  deviceId?: string
  cameraId: string
  hardwareDeviceId?: string
  hardwareCameraId?: string
  initialBorderLine?: Array<[number, number]> | null
  referenceImageUrl?: string
  onSave?: (borderLine: Array<[number, number]> | null) => void | Promise<void>
  embedded?: boolean
}

export function VirtualBorderCanvas({
  deviceId,
  cameraId,
  hardwareDeviceId,
  hardwareCameraId,
  initialBorderLine = null,
  referenceImageUrl,
  onSave,
  embedded = false
}: VirtualBorderCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Convert initial border line to internal format
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

  // Draw border line on canvas (legacy - kept for compatibility)
  const drawBorderLine = useCallback((
    ctx: CanvasRenderingContext2D,
    points: BorderPoint[],
    width: number,
    height: number,
    color: string,
    isDraft: boolean = false
  ) => {
    // This is now handled inside the main effect with proper letterboxing
    // Keeping as stub to avoid breaking references
  }, [])

  // Main canvas drawing effect
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const drawCanvas = (img: HTMLImageElement | null) => {
      const { displayWidth, displayHeight, offsetX, offsetY } = getImageDisplayMetrics()
      
      ctx.fillStyle = '#09090b'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      if (img) {
        ctx.drawImage(img, offsetX, offsetY, displayWidth, displayHeight)
      }

      // Draw saved border line
      if (borderPoints && borderPoints.length === 2) {
        drawBorderLineWithOffset(ctx, borderPoints, offsetX, offsetY, displayWidth, displayHeight, '#f59e0b', false)
      }

      // Draw current points being built
      if (currentPoints.length > 0) {
        drawBorderLineWithOffset(ctx, currentPoints, offsetX, offsetY, displayWidth, displayHeight, '#3b82f6', true)
      }
    }

    // Calculate display metrics accounting for object-contain letterboxing
    const getImageDisplayMetrics = () => {
      const containerW = container.clientWidth
      const containerH = container.clientHeight
      
      if (!imageLoaded || canvas.width === 0 || canvas.height === 0) {
        return { displayWidth: containerW, displayHeight: containerH, offsetX: 0, offsetY: 0 }
      }
      
      // Canvas internal size matches image aspect ratio
      const canvasRatio = canvas.width / canvas.height
      const containerRatio = containerW / containerH
      
      let displayWidth: number
      let displayHeight: number
      let offsetX = 0
      let offsetY = 0
      
      if (canvasRatio > containerRatio) {
        // Canvas wider than container - fit width, add vertical letterbox
        displayWidth = containerW
        displayHeight = containerW / canvasRatio
        offsetY = (containerH - displayHeight) / 2
      } else {
        // Canvas taller than container - fit height, add horizontal letterbox
        displayHeight = containerH
        displayWidth = containerH * canvasRatio
        offsetX = (containerW - displayWidth) / 2
      }
      
      return { displayWidth, displayHeight, offsetX, offsetY }
    }

    // Draw border line with letterboxing offset
    const drawBorderLineWithOffset = (
      ctx: CanvasRenderingContext2D,
      points: BorderPoint[],
      offsetX: number,
      offsetY: number,
      width: number,
      height: number,
      color: string,
      isDraft: boolean
    ) => {
      if (points.length === 0) return

      const drawLine = (p1: BorderPoint, p2: BorderPoint) => {
        const x1 = offsetX + p1.x * width
        const y1 = offsetY + p1.y * height
        const x2 = offsetX + p2.x * width
        const y2 = offsetY + p2.y * height
        
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.strokeStyle = color
        ctx.lineWidth = isDraft ? 2 : 4
        ctx.setLineDash(isDraft ? [8, 4] : [])
        ctx.stroke()
        ctx.setLineDash([])
      }

      // Draw line segments
      for (let i = 0; i < points.length - 1; i++) {
        drawLine(points[i], points[i + 1])
      }

      // Draw endpoint markers
      points.forEach((p, index) => {
        const px = offsetX + p.x * width
        const py = offsetY + p.y * height
        
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
        const startX = offsetX + points[0].x * width
        const startY = offsetY + points[0].y * height
        const endX = offsetX + points[1].x * width
        const endY = offsetY + points[1].y * height
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

    if (!snapshotUrl) {
      setImageLoaded(false)
      ctx.fillStyle = '#09090b'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      return
    }

    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.src = snapshotUrl
    
    img.onload = () => {
      // Set canvas internal size to match image aspect ratio
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
      ctx.fillStyle = '#09090b'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
  }, [snapshotUrl, borderPoints, currentPoints])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imageLoaded) return

    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const rect = canvas.getBoundingClientRect()
    
    // Calculate actual image display area (accounting for object-contain letterboxing)
    const canvasRatio = canvas.width / canvas.height
    const containerRatio = rect.width / rect.height
    
    let displayWidth: number
    let displayHeight: number
    let offsetX = 0
    let offsetY = 0
    
    if (canvasRatio > containerRatio) {
      displayWidth = rect.width
      displayHeight = rect.width / canvasRatio
      offsetY = (rect.height - displayHeight) / 2
    } else {
      displayHeight = rect.height
      displayWidth = rect.height * canvasRatio
      offsetX = (rect.width - displayWidth) / 2
    }
    
    // Click position relative to canvas
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top
    
    // Check if click is within the actual image area
    if (clickX < offsetX || clickX > offsetX + displayWidth ||
        clickY < offsetY || clickY > offsetY + displayHeight) {
      return // Clicked in letterbox area, ignore
    }
    
    // Normalize to image coordinates (0.0-1.0)
    const x = (clickX - offsetX) / displayWidth
    const y = (clickY - offsetY) / displayHeight

    if (!isDrawing) {
      setIsDrawing(true)
      setCurrentPoints([{ x, y }])
    } else if (currentPoints.length === 1) {
      const newPoints = [...currentPoints, { x, y }]
      setCurrentPoints(newPoints)
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
    if (!borderPoints || borderPoints.length !== 2) {
      toast.add({ title: 'Warning', description: 'Draw a border line before saving' })
      return
    }

    setIsSaving(true)
    
    try {
      // Convert to backend format: [[x1, y1], [x2, y2]]
      const borderLineData: Array<[number, number]> = [
        [borderPoints[0].x, borderPoints[0].y],
        [borderPoints[1].x, borderPoints[1].y]
      ]

      // If onSave callback provided, use it (embedded mode)
      if (onSave) {
        await onSave(borderLineData)
        toast.add({ title: 'Line Saved', description: 'Border line configured' })
      } else {
        // Standalone mode - save directly to database
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

  // Embedded mode - simplified UI
  if (embedded) {
    return (
      <div className="relative">
        {/* Canvas Controls Overlay */}
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          {currentPoints.length === 2 && (
            <Button size="sm" variant="secondary" onClick={handleFinishLine} className="shadow-lg">
              <Check className="h-4 w-4 mr-1" />
              Confirm Line
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
              <Undo className="h-4 w-4 mr-1" />
              Reset
            </Button>
            <Button 
              size="sm" 
              onClick={handleSaveSettings}
              disabled={isSaving || !borderPoints}
            >
              <Save className="h-4 w-4 mr-1" />
              {isSaving ? 'Saving...' : 'Apply Line'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Standalone mode - full UI
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 overflow-hidden rounded-xl border border-border/50">
        <div className="bg-muted/50 p-4 flex items-center justify-between border-b">
          <div>
            <h3 className="font-medium">Draw Virtual Border Line</h3>
            <p className="text-sm text-muted-foreground">Click to place start and end points</p>
          </div>
          <div className="flex gap-2">
            {currentPoints.length === 2 && (
              <Button size="sm" variant="secondary" onClick={handleFinishLine}>
                Confirm Line
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
          <h4 className="font-medium mb-3">Instructions</h4>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>Fetch a live snapshot from the camera</li>
            <li>Click to place point A (green) - start of line</li>
            <li>Click to place point B (blue) - end of line</li>
            <li>Click "Confirm Line" to save</li>
            <li>Push to edge device</li>
          </ol>
          
          {borderPoints && borderPoints.length === 2 && (
            <div className="mt-4 pt-4 border-t">
              <h5 className="text-sm font-medium mb-2">Current Border Line</h5>
              <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                <span className="text-sm font-medium text-amber-600">Line A → B</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={handleClearLine}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="pt-4 mt-4 border-t flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={handleResetCurrent}
              disabled={!isDrawing && currentPoints.length === 0}
            >
              <Undo className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button 
              className="flex-1"
              onClick={handleSaveSettings}
              disabled={isSaving || !borderPoints}
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
