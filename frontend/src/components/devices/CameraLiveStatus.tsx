'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { createClient } from '@/utils/supabase/client'
import { 
  WifiSlashIcon, 
  PulseIcon,
  PulseIcon as ActivityIcon
} from '@phosphor-icons/react/dist/ssr'
import { cn } from '@/lib/utils'

interface CameraLiveStatusProps {
  cameraId: string
  hardwareDeviceId?: string
}

interface DetectionStats {
  recentCount: number
  lastDetectionAt: string | null
}

interface CommandStats {
  pendingCount: number
}

export function CameraLiveStatus({ 
  cameraId, 
  hardwareDeviceId 
}: CameraLiveStatusProps) {
  const supabase = createClient()
  const [isOnline, setIsOnline] = useState<boolean | null>(null)
  const [detectionStats, setDetectionStats] = useState<DetectionStats>({
    recentCount: 0,
    lastDetectionAt: null
  })
  const [commandStats, setCommandStats] = useState<CommandStats>({
    pendingCount: 0
  })

  // Subscribe to camera status changes
  useEffect(() => {
    const channel = supabase
      .channel(`camera_live_status:${cameraId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cameras',
          filter: `id=eq.${cameraId}`
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
  }, [supabase, cameraId])

  // Fetch initial camera status
  useEffect(() => {
    const fetchInitial = async () => {
      const { data } = await supabase
        .from('cameras')
        .select('is_online')
        .eq('id', cameraId)
        .maybeSingle()
      
      if (data) {
        setIsOnline(data.is_online)
      }
    }
    fetchInitial()
  }, [supabase, cameraId])

  // Subscribe to recent detections and pending commands
  useEffect(() => {
    const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString()

    const fetchDetectionStats = async () => {
      const { count } = await supabase
        .from('detections')
        .select('*', { count: 'exact', head: true })
        .eq('camera_id', cameraId)
        .gte('created_at', thirtySecondsAgo)
      
      setDetectionStats(prev => ({ ...prev, recentCount: count || 0 }))

      // Get latest detection
      const { data: latest } = await supabase
        .from('detections')
        .select('created_at')
        .eq('camera_id', cameraId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (latest) {
        setDetectionStats(prev => ({ ...prev, lastDetectionAt: latest.created_at }))
      }
    }

    const fetchCommandStats = async () => {
      if (!hardwareDeviceId) return
      const { count } = await supabase
        .from('device_commands')
        .select('*', { count: 'exact', head: true })
        .eq('device_id', hardwareDeviceId)
        .eq('camera_id', cameraId)
        .eq('status', 'pending')
      
      setCommandStats({ pendingCount: count || 0 })
    }

    fetchDetectionStats()
    fetchCommandStats()

    const interval = setInterval(() => {
      fetchDetectionStats()
      fetchCommandStats()
    }, 5000)

    // Subscribe to new detections
    const detectionChannel = supabase
      .channel(`camera_detections:${cameraId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'detections',
          filter: `camera_id=eq.${cameraId}`
        },
        () => {
          fetchDetectionStats()
        }
      )
      .subscribe()

    // Subscribe to command updates
    const commandChannel = hardwareDeviceId
      ? supabase
          .channel(`camera_commands:${cameraId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'device_commands',
              filter: `camera_id=eq.${cameraId}`
            },
            () => {
              fetchCommandStats()
            }
          )
          .subscribe()
      : null

    return () => {
      clearInterval(interval)
      supabase.removeChannel(detectionChannel)
      if (commandChannel) supabase.removeChannel(commandChannel)
    }
  }, [supabase, cameraId, hardwareDeviceId])

  const formatTimeAgo = (timestamp: string | null) => {
    if (!timestamp) return 'Never'
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    
    if (diffSecs < 60) return `${diffSecs}s ago`
    if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`
    if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`
    return date.toLocaleDateString()
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ActivityIcon className="size-4" />
          Live Status
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Online Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Camera Status</span>
          {isOnline === null ? (
            <Badge variant="outline" className="gap-1.5">
              <Spinner className="size-3" />
              Checking...
            </Badge>
          ) : isOnline ? (
            <Badge className="gap-1.5 bg-green-500/10 text-green-600 border-green-500/30 hover:bg-green-500/20">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-green-500" />
              </span>
              Online
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1.5">
              <WifiSlashIcon className="size-3" />
              Offline
            </Badge>
          )}
        </div>

        <div className="h-px bg-border" />

        {/* Detection Activity */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Detections (30s)</span>
          <Badge variant={detectionStats.recentCount > 0 ? "default" : "outline"} className={cn(
            "font-mono",
            detectionStats.recentCount > 0 && "bg-blue-500/10 text-blue-600 border-blue-500/30"
          )}>
            <PulseIcon className="size-3 mr-1" />
            {detectionStats.recentCount}
          </Badge>
        </div>

        {/* Last Detection */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Last Detection</span>
          <span className="text-sm font-medium">
            {formatTimeAgo(detectionStats.lastDetectionAt)}
          </span>
        </div>

        {/* Pending Commands */}
        {commandStats.pendingCount > 0 && (
          <>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Pending Commands</span>
              <Badge variant="outline" className="gap-1.5 border-amber-500/30 bg-amber-500/10 text-amber-600">
                <Spinner className="size-3" />
                {commandStats.pendingCount}
              </Badge>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
