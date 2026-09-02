import { createClient } from '@/utils/supabase/server'
import { CameraSettingsForm } from './_components/CameraSettingsForm'
import { DeviceCameraMatrix } from './_components/DeviceCameraMatrix'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Camera, Cpu } from 'lucide-react'

export default async function DeviceSettingsPage(props: { params: Promise<{ id: string }>, searchParams: Promise<{ camera?: string }> }) {
  const supabase = await createClient()

  const resolvedParams = await props.params
  const resolvedSearchParams = await props.searchParams
  const deviceId = resolvedParams.id
  const selectedCameraId = resolvedSearchParams.camera

  const { data: device, error } = await supabase
    .from('devices')
    .select('*, cameras(*)')
    .eq('id', deviceId)
    .single()

  if (error || !device) {
    notFound()
  }

  // Find selected camera if provided
  const selectedCamera = selectedCameraId 
    ? device.cameras?.find((c: { id: string, camera_id: string, name: string | null, is_online?: boolean }) => c.id === selectedCameraId) 
    : null

  // Fetch camera settings
  let cameraSettings = null
  if (selectedCamera?.camera_id) {
    const { data: camSettingsData } = await supabase
      .from('camera_settings')
      .select('settings')
      .eq('camera_id', selectedCamera.camera_id)
      .maybeSingle()
    
    cameraSettings = camSettingsData?.settings || {}
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link 
            href={`/infrastructure/${deviceId}`} 
            className="rounded-lg p-2 hover:bg-muted text-muted-foreground transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{device.name || 'Unnamed Device'}</h2>
            <p className="text-muted-foreground text-sm font-mono">
              {device.device_id}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {selectedCamera ? (
            // Show camera status when a camera is selected
            selectedCamera.is_online ? (
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                <span className="relative flex size-2 mr-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-green-500" />
                </span>
                Camera Online
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-zinc-500/10 text-zinc-500 border-zinc-500/30">
                Camera Offline
              </Badge>
            )
          ) : device.is_online ? (
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
              <span className="relative flex size-2 mr-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-green-500" />
              </span>
              Device Online
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-zinc-500/10 text-zinc-500 border-zinc-500/30">
              Device Offline
            </Badge>
          )}
        </div>
      </div>

      {/* Camera Selection or Settings */}
      {selectedCamera ? (
        <CameraSettingsForm 
          cameraId={selectedCamera.camera_id}
          hardwareDeviceId={device.device_id}
          hardwareCameraId={selectedCamera.camera_id}
          initialSettings={cameraSettings}
        />
      ) : (
        <Card className="border-border/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <Camera className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Select a Camera</CardTitle>
                <CardDescription>
                  Choose a camera from the list below to configure its settings
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <DeviceCameraMatrix 
              deviceId={deviceId} 
              initialCameras={device.cameras || []} 
              showSelectButton={true}
            />
          </CardContent>
        </Card>
      )}

      {/* Device Info Card - Always visible */}
      {selectedCamera && (
        <Card className="border-border/50 bg-muted/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Cpu className="h-4 w-4" />
                  <span>Device: {device.name || device.device_id}</span>
                </div>
                <div className="h-4 w-px bg-border" />
                <Link 
                  href={`/infrastructure/${deviceId}/settings`}
                  className="text-sm text-primary hover:underline"
                >
                  Switch camera
                </Link>
              </div>
              {device.last_seen_at && (
                <span className="text-xs text-muted-foreground">
                  Last seen: {new Date(device.last_seen_at).toLocaleString()}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
