'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { createClient } from '@/utils/supabase/client'
import { EyeIcon, ClockIcon, TargetIcon } from '@phosphor-icons/react/dist/ssr'
import { cn } from '@/lib/utils'

interface Detection {
  id: string
  class_name: string | null
  confidence: number | null
  bbox_xyxy: number[] | null
  evidence_path: string | null
  created_at: string
}

interface LastDetectionPreviewProps {
  cameraId: string
  snapshotUrl: string | null
  // image natural width/height to scale normalized bbox; null until snapshot loads
  imageWidth: number | null
  imageHeight: number | null
}

function formatTimeAgo(timestamp: string | null): string {
  if (!timestamp) return 'Never'
  const diffSecs = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000)
  if (diffSecs < 60) return `${diffSecs}s ago`
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`
  return new Date(timestamp).toLocaleDateString()
}

function bboxToPercent(bbox: number[] | null, w: number, h: number) {
  if (!bbox || bbox.length !== 4) return null
  const [x1, y1, x2, y2] = bbox
  return {
    left: (x1 / w) * 100,
    top: (y1 / h) * 100,
    width: ((x2 - x1) / w) * 100,
    height: ((y2 - y1) / h) * 100,
  }
}

export function LastDetectionPreview({
  cameraId,
  snapshotUrl,
  imageWidth,
  imageHeight,
}: LastDetectionPreviewProps) {
  const [supabase] = useState(() => createClient())
  const [detection, setDetection] = useState<Detection | null>(null)
  const [loading, setLoading] = useState(true)

  // Initial fetch of most recent detection
  useEffect(() => {
    let cancelled = false
    const fetch = async () => {
      const { data } = await supabase
        .from('detections')
        .select('id, class_name, confidence, bbox_xyxy, evidence_path, created_at')
        .eq('camera_id', cameraId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!cancelled) {
        setDetection(data as Detection | null)
        setLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [supabase, cameraId])

  // Subscribe to new detections
  useEffect(() => {
    const channel = supabase
      .channel(`last_detection:${cameraId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'detections',
          filter: `camera_id=eq.${cameraId}`
        },
        (payload) => {
          setDetection(payload.new as Detection)
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, cameraId])

  const previewSrc = detection?.evidence_path
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/evidence/${detection.evidence_path}`
    : snapshotUrl

  const bbox = bboxToPercent(detection?.bbox_xyxy ?? null, imageWidth ?? 0, imageHeight ?? 0)

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
            <EyeIcon className="size-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base">Last Detection</CardTitle>
            <CardDescription>Most recent object detected on this camera</CardDescription>
          </div>
          {detection && (
            <Badge variant="outline" className="gap-1.5">
              <ClockIcon className="size-3" />
              {formatTimeAgo(detection.created_at)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed bg-muted/30">
            <Spinner className="size-6 text-muted-foreground" />
          </div>
        ) : !detection ? (
          <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 text-center text-sm text-muted-foreground">
            <TargetIcon className="size-8 opacity-40" />
            <span>No detections yet</span>
            <span className="text-xs">Live updates will appear here as soon as an event is detected.</span>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-lg border bg-black">
            {previewSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewSrc}
                alt="Last detection"
                className="block w-full h-auto"
              />
            ) : (
              <div className="flex aspect-video items-center justify-center bg-muted text-xs text-muted-foreground">
                No snapshot available
              </div>
            )}
            {bbox && (
              <div
                className="pointer-events-none absolute border-2 border-red-500 shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
                style={{
                  left: `${bbox.left}%`,
                  top: `${bbox.top}%`,
                  width: `${bbox.width}%`,
                  height: `${bbox.height}%`,
                }}
              >
                <div className={cn(
                  "absolute -top-6 left-0 flex items-center gap-1 rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white whitespace-nowrap"
                )}>
                  {detection.class_name ?? 'object'}
                  {detection.confidence != null && (
                    <span className="opacity-80">
                      {(detection.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
