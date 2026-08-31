import { createClient } from '@/utils/supabase/server'
import { VirtualFenceCanvas, type Polygon } from '@/components/devices/VirtualFenceCanvas'
import { DeviceCameraMatrix } from '@/components/infrastructure/DeviceCameraMatrix'
import { CameraSettingsForm } from '@/components/devices/CameraSettingsForm'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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
    ? device.cameras?.find((c: { id: string, camera_id: string, name: string | null }) => c.id === selectedCameraId) 
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

  // In a real scenario, this would be a recent snapshot from the `alerts` or a dedicated `camera_snapshots` bucket.
  const placeholderImageUrl = 'https://images.unsplash.com/photo-1558231221-a3f721524e9f?q=80&w=1200&auto=format&fit=crop'
  
  // Parse existing polygons for the selected camera from the camera_settings JSON
  let existingPolygons: Polygon[] = []
  if (cameraSettings && typeof cameraSettings === 'object') {
    const rootSettings = cameraSettings as Record<string, unknown>
    if (rootSettings.virtual_fences) {
      existingPolygons = rootSettings.virtual_fences as Polygon[]
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/infrastructure" className="rounded-md p-2 hover:bg-muted text-muted-foreground transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Configure: {device.name}</h2>
          <p className="text-muted-foreground">
            ID: {device.device_id}
          </p>
        </div>
      </div>

      <Tabs defaultValue={selectedCameraId ? "general" : "info"} className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">Device Info</TabsTrigger>
          <TabsTrigger value="cameras">Cameras</TabsTrigger>
          {selectedCameraId && <TabsTrigger value="general">Camera Settings ({selectedCamera?.name || 'Selected'})</TabsTrigger>}
          {selectedCameraId && <TabsTrigger value="fences">Virtual Fences</TabsTrigger>}
        </TabsList>
        
        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Device Information</CardTitle>
              <CardDescription>General settings and metadata for this edge node.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-muted-foreground">Location</p>
                  <p>{device.location || 'Not set'}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Status</p>
                  <p>{device.is_online ? 'Online' : 'Offline'}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Last Seen</p>
                  <p>{device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : 'Never'}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Internal Device ID</p>
                  <p className="font-mono text-xs">{device.device_id}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="cameras" className="space-y-4">
          <DeviceCameraMatrix deviceId={deviceId} initialCameras={device.cameras || []} />
        </TabsContent>

        {selectedCamera && selectedCamera.camera_id && (
          <TabsContent value="general" className="space-y-4">
            <CameraSettingsForm 
              cameraId={selectedCamera.camera_id} 
              initialSettings={cameraSettings} 
            />
          </TabsContent>
        )}
        
        {selectedCamera && selectedCamera.camera_id && (
          <TabsContent value="fences" className="space-y-4">
            <VirtualFenceCanvas 
              deviceId={deviceId} 
              cameraId={selectedCamera.camera_id}
              initialPolygons={existingPolygons}
              hardwareCameraId={selectedCamera.camera_id}
              hardwareDeviceId={device.device_id}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
