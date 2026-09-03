'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPinIcon, ActivityIcon, GearIcon } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { createClient } from '@/utils/supabase/client'
import { Database } from '@/types/database.types'

type Device = Database['public']['Tables']['devices']['Row'] & {
  cameras: Database['public']['Tables']['cameras']['Row'][] | null
}

export function InfrastructureGrid({ initialDevices }: { initialDevices: Device[] }) {
  const [devices, setDevices] = useState<Device[]>(initialDevices)
  // We need to use state for the supabase client so it's not recreated on every render
  const [supabase] = useState(() => createClient())

  useEffect(() => {
    // Subscribe to realtime updates on the devices table
    // specifically looking for online status and last_seen changes
    const channel = supabase
      .channel('public:devices')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'devices' },
        (payload) => {
          setDevices((currentDevices) =>
            currentDevices.map((device) =>
              device.id === payload.new.id
                ? { ...device, ...payload.new }
                : device
            )
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'devices' },
        async (payload) => {
          // Fetch the full device with cameras when a new one is added
          const { data } = await supabase
            .from('devices')
            .select(`
              *,
              cameras (
                id,
                device_id,
                name,
                source_url,
                is_online,
                created_at
              )
            `)
            .eq('id', payload.new.id)
            .single()

          if (data) {
            setDevices((current) => [data as Device, ...current])
          }
        }
      )
      // Keep camera online badges fresh on the list page
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'cameras' },
        (payload) => {
          const updated = payload.new as { id: string; is_online: boolean }
          setDevices((currentDevices) =>
            currentDevices.map((device) =>
              (device.cameras || []).some((c) => c.id === updated.id)
                ? {
                    ...device,
                    cameras: (device.cameras || []).map((c) =>
                      c.id === updated.id ? { ...c, is_online: updated.is_online } : c
                    ),
                  }
                : device
            )
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'cameras' },
        (payload) => {
          const newCamera = payload.new as Database['public']['Tables']['cameras']['Row']
          setDevices((currentDevices) =>
            currentDevices.map((device) =>
              device.id === newCamera.device_id
                ? { ...device, cameras: [...(device.cameras || []), newCamera] }
                : device
            )
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'cameras' },
        (payload) => {
          const oldCamera = payload.old as { id: string }
          setDevices((currentDevices) =>
            currentDevices.map((device) => ({
              ...device,
              cameras: (device.cameras || []).filter((c) => c.id !== oldCamera.id),
            }))
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {devices?.map((device) => (
        <Card key={device.id} className="flex flex-col">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">{device.name}</CardTitle>
                <CardDescription className="flex items-center gap-1 mt-1">
                  <MapPinIcon className="h-3 w-3" weight="duotone" />
                  {device.location || 'Unknown location'}
                </CardDescription>
              </div>
              <Badge variant={device.is_online ? "default" : "destructive"} className={device.is_online ? "bg-green-500/10 text-green-500 hover:bg-green-500/20" : ""}>
                {device.is_online ? 'Online' : 'Offline'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ActivityIcon className="h-4 w-4" weight="duotone" />
                Last seen: {device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : 'Never'}
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Connected Cameras</h4>
                  <Badge variant="secondary" className="font-normal text-xs">
                    {device.cameras?.length || 0} Total
                  </Badge>
                </div>
                <div className="space-y-2">
                  {device.cameras?.map((camera) => (
                    <div key={camera.id} className="flex items-center justify-between rounded-md border border-border/50 bg-background/50 p-2 text-sm group transition-colors hover:border-border">
                      <div className="flex flex-col gap-1">
                        <span className="truncate max-w-[150px] font-medium">{camera.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={camera.is_online ? "text-green-500 bg-green-500/10" : "text-muted-foreground bg-muted/50"}>
                          {camera.is_online ? 'Active' : 'Offline'}
                        </Badge>
                        <Link href={`/infrastructure/${device.id}?camera=${camera.id}`} passHref>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                            <GearIcon className="h-4 w-4" />
                            <span className="sr-only">Configure</span>
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                  {(!device.cameras || device.cameras.length === 0) && (
                    <div className="text-sm text-muted-foreground italic bg-muted/30 p-3 rounded-md text-center">No cameras configured.</div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
          <div className="p-4 pt-0 mt-auto">
            <Link href={`/infrastructure/${device.id}`} passHref>
              <Button variant="outline" className="w-full gap-2">
                <GearIcon className="h-4 w-4" />
                Manage Cameras
              </Button>
            </Link>
          </div>
        </Card>
      ))}

      {devices?.length === 0 && (
        <div className="col-span-full flex min-h-[300px] flex-col items-center justify-center rounded-lg border border-dashed border-border/50 p-8 text-center">
          <h3 className="text-lg font-semibold">No devices found</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Edge devices will appear here once they connect and authenticate with the central server.
          </p>
        </div>
      )}
    </div>
  )
}
