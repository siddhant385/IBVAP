'use client'

import { useState } from 'react'

interface BBoxOverlayProps {
  imageUrl: string
  detections: { id: string, feature: string, class_name: string | null, confidence: number, bbox_xyxy: number[] | null }[]
}

export function BBoxOverlay({ imageUrl, detections }: BBoxOverlayProps) {
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget
    setImageSize({ width: naturalWidth, height: naturalHeight })
  }

  const getFeatureColor = (feature: string) => {
    switch (feature) {
      case 'intrusion_detection': return 'border-destructive text-destructive bg-destructive/10'
      case 'face_recognition': return 'border-blue-500 text-blue-500 bg-blue-500/10'
      case 'anpr': return 'border-yellow-500 text-yellow-500 bg-yellow-500/10'
      default: return 'border-primary text-primary bg-primary/10'
    }
  }

  return (
    <div className="relative w-full overflow-hidden flex items-center justify-center min-h-[400px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt="Evidence Frame"
        className="w-full h-auto object-contain max-h-[70vh]"
        onLoad={handleImageLoad}
      />
      
      {imageSize.width > 0 && detections.map((det) => {
        if (!det.bbox_xyxy || det.bbox_xyxy.length !== 4) return null
        
        const [x1, y1, x2, y2] = det.bbox_xyxy
        
        // These coordinates from AI models are usually normalized (0-1) or absolute pixels.
        // Assuming normalized for this implementation based on standard edge AI outputs.
        // If they are absolute pixels, we'd divide by imageSize.width/height.
        const isNormalized = x1 <= 1.0 && x2 <= 1.0 && y1 <= 1.0 && y2 <= 1.0
        
        let left = x1 * 100
        let top = y1 * 100
        let width = (x2 - x1) * 100
        let height = (y2 - y1) * 100

        if (!isNormalized) {
          left = (x1 / imageSize.width) * 100
          top = (y1 / imageSize.height) * 100
          width = ((x2 - x1) / imageSize.width) * 100
          height = ((y2 - y1) / imageSize.height) * 100
        }

        const colorClass = getFeatureColor(det.feature)

        return (
          <div
            key={det.id}
            className={`absolute border-2 flex flex-col ${colorClass}`}
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${width}%`,
              height: `${height}%`,
            }}
          >
            <div className={`absolute -top-6 left-[-2px] whitespace-nowrap px-1 py-0.5 text-[10px] font-bold uppercase border-2 ${colorClass} bg-background`}>
              {det.class_name || det.feature.replace('_', ' ')} {(det.confidence * 100).toFixed(0)}%
            </div>
          </div>
        )
      })}
    </div>
  )
}
