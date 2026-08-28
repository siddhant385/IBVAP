import { createClient } from '@/utils/supabase/server'
import { VirtualFenceCanvas, type Polygon } from '@/components/devices/VirtualFenceCanvas'
import { DeviceCameraMatrix } from '@/components/infrastructure/DeviceCameraMatrix'
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

  const { data: settings } = await supabase
    .from('device_settings')
    .select('settings')
    .eq('device_id', deviceId)
    .single()

  // Find selected camera if provided
  const selectedCamera = selectedCameraId 
    ? device.cameras?.find((c: { id: string }) => c.id === selectedCameraId) 
    : null

  // In a real scenario, this would be a recent snapshot from the `alerts` or a dedicated `camera_snapshots` bucket.
  const placeholderImageUrl = 'https://images.unsplash.com/photo-1558231221-a3f721524e9f?q=80&w=1200&auto=format&fit=crop'
  
  // Parse existing polygons for the selected camera from nested settings
  let existingPolygons: Polygon[] = []
  if (selectedCameraId && settings?.settings && typeof settings.settings === 'object') {
    const rootSettings = settings.settings as Record<string, unknown>
    if (rootSettings.cameras && (rootSettings.cameras as Record<string, unknown>)[selectedCameraId]) {
      const cameraSettings = (rootSettings.cameras as Record<string, unknown>)[selectedCameraId] as Record<string, unknown>
      if (cameraSettings.virtual_fences) {
        existingPolygons = cameraSettings.virtual_fences as Polygon[]
      }
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

      <Tabs defaultValue={selectedCameraId ? "fences" : "cameras"} className="space-y-4">
        <TabsList>
          <TabsTrigger value="cameras">Cameras</TabsTrigger>
          {selectedCameraId && <TabsTrigger value="fences">Virtual Fences ({selectedCamera?.name || 'Selected Camera'})</TabsTrigger>}
          <TabsTrigger value="info">Device Info</TabsTrigger>
        </TabsList>
        
        <TabsContent value="cameras" className="space-y-4">
          <DeviceCameraMatrix deviceId={deviceId} initialCameras={device.cameras || []} />
        </TabsContent>
        
        {selectedCameraId && (
          <TabsContent value="fences" className="space-y-4">
            <VirtualFenceCanvas 
              deviceId={deviceId} 
              cameraId={selectedCameraId}
              referenceImageUrl={placeholderImageUrl}
              initialPolygons={existingPolygons}
            />
          </TabsContent>
        )}

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
      </Tabs>
    </div>
  )
}
