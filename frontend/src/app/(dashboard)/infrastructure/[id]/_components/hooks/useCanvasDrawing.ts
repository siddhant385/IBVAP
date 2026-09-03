'use client'

import { useEffect, useRef, useState } from 'react'

interface UseCanvasDrawingOptions {
  snapshotUrl: string | null
  onDraw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void
}

interface UseCanvasDrawingReturn {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  containerRef: React.RefObject<HTMLDivElement | null>
  imageLoaded: boolean
}

/**
 * Hook to manage canvas dimensions and image loading.
 * Calculates canvas size based on image aspect ratio and container width.
 * Re-draws whenever the image or draw callback changes.
 */
export function useCanvasDrawing({
  snapshotUrl,
  onDraw
}: UseCanvasDrawingOptions): UseCanvasDrawingReturn {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const onDrawRef = useRef(onDraw)

  // Keep latest draw callback in ref to avoid re-running effect
  useEffect(() => {
    onDrawRef.current = onDraw
  }, [onDraw])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const renderCanvas = (img: HTMLImageElement | null) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (img) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      }
      onDrawRef.current(ctx, canvas.width, canvas.height)
    }

    if (!snapshotUrl) {
      setImageLoaded(false)
      renderCanvas(null)
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
      renderCanvas(img)
    }

    img.onerror = () => {
      setImageLoaded(false)
      renderCanvas(null)
    }
  }, [snapshotUrl])

  return { canvasRef, containerRef, imageLoaded }
}
