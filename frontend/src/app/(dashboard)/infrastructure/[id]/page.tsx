import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CameraCard } from './_components/CameraCard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { 
  CaretLeftIcon, 
  CpuIcon, 
  WifiHighIcon, 
  WifiSlashIcon,
  ClockIcon,
  VideoCameraIcon
} from '@phosphor-icons/react/dist/ssr'
import { Database } from '@/types/database.types'

type Camera = Database['public']['Tables']['cameras']['Row']

export default async function DeviceOverviewPage(props: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await props.params
  const supabase = await createClient()

  const { data: device, error } = await supabase
    .from('devices')
    .select(`
      *,
      cameras (*)
    `)
    .eq('id', id)
    .single()

  if (error || !device) {
    notFound()
  }

  const cameras = (device.cameras || []) as Camera[]
  const onlineCameras = cameras.filter(c => c.is_online).length

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" render={<Link href="/infrastructure" />}>
            <CaretLeftIcon className="size-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {device.name || 'Unnamed Device'}
            </h2>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-mono">{device.device_id}</span>
              {device.location && (
                <>
                  <span className="text-muted-foreground/50">•</span>
                  <span>{device.location}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <Badge 
          variant="outline" 
          className={device.is_online 
            ? "gap-1.5 bg-green-500/10 text-green-600 border-green-500/30 self-start" 
            : "gap-1.5 self-start"
          }
        >
          {device.is_online ? (
            <>
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-green-500" />
              </span>
              Device Online
            </>
          ) : (
            <>
              <WifiSlashIcon className="size-3" />
              Device Offline
            </>
          )}
        </Badge>
      </div>

      {/* Device Stats */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <CpuIcon className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Device Information</CardTitle>
              <CardDescription>Status and metadata for this edge node</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Status</span>
              <span className="flex items-center gap-2 font-medium">
                {device.is_online ? (
                  <>
                    <WifiHighIcon className="size-4 text-green-500" />
                    Online
                  </>
                ) : (
                  <>
                    <WifiSlashIcon className="size-4 text-muted-foreground" />
                    Offline
                  </>
                )}
              </span>
            </div>
            
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Cameras</span>
              <span className="font-mono text-lg font-semibold">
                {onlineCameras}<span className="text-muted-foreground">/{cameras.length}</span>
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Last Seen</span>
              <span className="flex items-center gap-1.5 font-medium text-sm">
                <ClockIcon className="size-3.5 text-muted-foreground" />
                {device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : 'Never'}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Coordinates</span>
              <span className="font-mono text-xs text-muted-foreground truncate">
                {device.coordinates ? JSON.stringify(device.coordinates) : 'Not set'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cameras Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Cameras</h3>
            <p className="text-sm text-muted-foreground">
              {cameras.length} camera{cameras.length !== 1 ? 's' : ''} connected to this device
            </p>
          </div>
        </div>

        <Separator />

        {cameras.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cameras.map((camera) => (
              <CameraCard
                key={camera.id}
                deviceId={device.id}
                camera={{
                  id: camera.id,
                  name: camera.name,
                  camera_id: camera.camera_id,
                  source_url: camera.source_url,
                  is_online: camera.is_online
                }}
              />
            ))}
          </div>
        ) : (
          <Empty className="border-border/50">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <VideoCameraIcon />
              </EmptyMedia>
              <EmptyTitle>No cameras configured</EmptyTitle>
              <EmptyDescription>
                This device has no cameras registered. Configure cameras on the edge device to start streaming.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </div>
  )
}
