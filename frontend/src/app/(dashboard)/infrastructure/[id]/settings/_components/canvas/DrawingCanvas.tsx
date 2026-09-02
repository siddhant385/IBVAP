'use client'

import { ReactNode } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { CloudSlashIcon } from '@phosphor-icons/react/dist/ssr'
import { useSnapshot } from '../hooks/useSnapshot'
import { useCanvasDrawing } from '../hooks/useCanvasDrawing'

interface DrawingCanvasProps {
  hardwareDeviceId?: string
  hardwareCameraId?: string
  isOffline?: boolean
  emptyMessage?: string
  /** Function called every time the canvas needs to draw */
  onDraw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void
  /** Optional click handler for normalized canvas coordinates (0-1) */
  onCanvasClick?: (normalizedX: number, normalizedY: number) => void
  /** Optional overlays (buttons, status) rendered on top of canvas */
  overlays?: ReactNode
}

/**
 * Base canvas component for drawing on camera snapshots.
 * Handles snapshot fetching, image loading, and canvas sizing.
 * Parent provides the actual drawing logic via onDraw prop.
 */
export function DrawingCanvas({
  hardwareDeviceId,
  hardwareCameraId,
  isOffline = false,
  emptyMessage = 'Fetch a snapshot to start drawing',
  onDraw,
  onCanvasClick,
  overlays
}: DrawingCanvasProps) {
  const { snapshotUrl, isRequestingSnapshot, snapshotStatus } = useSnapshot({
    hardwareDeviceId,
    hardwareCameraId,
    isOffline
  })

  const { canvasRef, containerRef, imageLoaded } = useCanvasDrawing({
    snapshotUrl,
    onDraw
  })

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imageLoaded || !onCanvasClick) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    
    // Canvas internal size matches the displayed size (no scaling)
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height

    onCanvasClick(x, y)
  }

  return (
    <div className="relative">
      {/* Custom overlays from parent */}
      {overlays}
      
      {/* Default status overlay if no custom overlays */}
      {!overlays && snapshotStatus && (
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
                <Spinner className="size-8" />
                <span className="text-sm">Waiting for snapshot...</span>
              </>
            ) : isOffline ? (
              <>
                <CloudSlashIcon className="size-8" />
                <span className="text-sm">Device offline</span>
              </>
            ) : (
              <span className="text-sm">{emptyMessage}</span>
            )}
          </div>
        )}
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          className="block max-w-full h-auto"
        />
      </div>
    </div>
  )
}

export { useSnapshot, useCanvasDrawing }
