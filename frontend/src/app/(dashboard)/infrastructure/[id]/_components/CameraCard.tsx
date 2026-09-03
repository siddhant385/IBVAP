'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createClient } from '@/utils/supabase/client'
import { 
  VideoCameraIcon, 
  GearIcon,
  ArrowRightIcon
} from '@phosphor-icons/react/dist/ssr'
import { cn } from '@/lib/utils'

interface CameraCardProps {
  deviceId: string
  camera: {
    id: string
    name: string | null
    camera_id: string
    source_url: string | null
    is_online: boolean | null
  }
}

export function CameraCard({ deviceId, camera }: CameraCardProps) {
  const [supabase] = useState(() => createClient())
  const [isOnline, setIsOnline] = useState(camera.is_online)
  const [detectionCount, setDetectionCount] = useState(0)

  // Subscribe to camera status
  useEffect(() => {
    const channel = supabase
      .channel(`camera_card:${camera.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cameras',
          filter: `id=eq.${camera.id}`
        },
        (payload) => {
          const updated = payload.new as { is_online: boolean }
          setIsOnline(updated.is_online)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, camera.id])

  // Get detection count for today
  useEffect(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const fetchCount = async () => {
      const { count } = await supabase
        .from('detections')
        .select('*', { count: 'exact', head: true })
        .eq('camera_id', camera.id)
        .gte('created_at', today.toISOString())
      
      setDetectionCount(count || 0)
    }

    fetchCount()

    const channel = supabase
      .channel(`camera_detections_count:${camera.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'detections',
          filter: `camera_id=eq.${camera.id}`
        },
        () => {
          fetchCount()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, camera.id])

  return (
    <Card className="border-border/50 transition-all hover:border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex size-10 items-center justify-center rounded-lg",
              isOnline ? "bg-green-500/10" : "bg-muted"
            )}>
              <VideoCameraIcon className={cn(
                "size-5",
                isOnline ? "text-green-600" : "text-muted-foreground"
              )} />
            </div>
            <div>
              <CardTitle className="text-base">
                {camera.name || 'Unnamed Camera'}
              </CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground font-mono truncate max-w-[180px]">
                {camera.camera_id}
              </p>
            </div>
          </div>
          
          {isOnline ? (
            <Badge className="gap-1.5 bg-green-500/10 text-green-600 border-green-500/30">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-green-500" />
              </span>
              Live
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1.5">
              Offline
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="flex flex-col gap-4">
        {camera.source_url && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="size-1.5 rounded-full bg-muted-foreground/50" />
            <span className="truncate font-mono text-xs">{camera.source_url.replace(/\/\/(.*)@/, '//***:***@')}</span>
          </div>
        )}

        <div className="flex items-center justify-between border-t pt-3">
          <div>
            <p className="text-xs text-muted-foreground">Today&apos;s Detections</p>
            <p className="font-mono text-lg font-semibold">
              {detectionCount.toLocaleString()}
            </p>
          </div>
          
          <Button variant="outline" size="sm" render={<Link href={`/infrastructure/${deviceId}?camera=${camera.id}`} />}>
            <GearIcon className="size-4" />
            Configure
            <ArrowRightIcon className="size-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
