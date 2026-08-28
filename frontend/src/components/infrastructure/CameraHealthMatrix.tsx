'use client'

import { useEffect, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Settings2, VideoOff } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { Database } from '@/types/database.types'

type Device = Database['public']['Tables']['devices']['Row'] & {
  cameras: Database['public']['Tables']['cameras']['Row'][] | null
}

type CameraRow = {
  id: string;
  name: string | null;
  device_id: string | null;
  device_name: string | null;
  is_online: boolean | null;
  source_url: string | null;
}

// Utility to mask URLs (e.g., rtsp://user:pass@192.168.1.10 -> rtsp://***:***@192.168.1.10)
const maskUrl = (url: string | null) => {
  if (!url) return 'N/A';
  try {
    const parsed = new URL(url);
    if (parsed.username) parsed.username = '***';
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch (_e) {
    // If it's not a valid URL format, basic string masking for rtsp credentials
    return url.replace(/\/\/(.*)@/, '//***:***@');
  }
}

export function CameraHealthMatrix({ initialDevices }: { initialDevices: Device[] }) {
  const [cameras, setCameras] = useState<CameraRow[]>(() => {
    const flat: CameraRow[] = [];
    initialDevices.forEach(device => {
      if (device.cameras) {
        device.cameras.forEach(cam => {
          flat.push({
            id: cam.id,
            name: cam.name,
            device_id: device.id,
            device_name: device.name,
            is_online: cam.is_online,
            source_url: cam.source_url
          })
        })
      }
    });
    return flat;
  });

  const [supabase] = useState(() => createClient())

  useEffect(() => {
    const channel = supabase
      .channel('public:cameras_matrix')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'cameras' },
        (payload) => {
          setCameras((currentCameras) =>
            currentCameras.map((cam) =>
              cam.id === payload.new.id
                ? { ...cam, is_online: payload.new.is_online, name: payload.new.name, source_url: payload.new.source_url }
                : cam
            )
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'cameras' },
        async (payload) => {
          // Fetch the device name for the newly added camera
          const { data: deviceData } = await supabase
            .from('devices')
            .select('name')
            .eq('id', payload.new.device_id)
            .single()

          setCameras((current) => [{
            id: payload.new.id,
            name: payload.new.name,
            device_id: payload.new.device_id,
            device_name: deviceData?.name || 'Unknown Device',
            is_online: payload.new.is_online,
            source_url: payload.new.source_url
          }, ...current])
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'cameras' },
        (payload) => {
          setCameras((current) => current.filter(c => c.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  if (cameras.length === 0) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border border-dashed border-border/50 bg-background/50 p-8 text-center">
        <VideoOff className="h-10 w-10 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">No cameras found</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-md">
          No cameras are currently connected to any of your edge devices. Configure cameras on your edge devices to see them here.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-md border bg-card text-card-foreground shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Camera Name</TableHead>
            <TableHead>Device</TableHead>
            <TableHead>Stream URL</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cameras.map((camera) => (
            <TableRow key={camera.id} className="group hover:bg-muted/50 transition-colors">
              <TableCell>
                <Badge variant={camera.is_online ? "default" : "secondary"} className={camera.is_online ? "bg-green-500/10 text-green-500 hover:bg-green-500/20" : "text-muted-foreground bg-muted/50"}>
                  {camera.is_online ? 'Active' : 'Offline'}
                </Badge>
              </TableCell>
              <TableCell className="font-medium">{camera.name || 'Unnamed Camera'}</TableCell>
              <TableCell>{camera.device_name || 'Unknown'}</TableCell>
              <TableCell className="text-muted-foreground font-mono text-xs">
                {maskUrl(camera.source_url)}
              </TableCell>
              <TableCell className="text-right">
                {camera.device_id ? (
                  <Link href={`/infrastructure/${camera.device_id}/settings?camera=${camera.id}`} passHref>
                    <Button variant="ghost" size="sm" className="gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Settings2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Configure</span>
                    </Button>
                  </Link>
                ) : (
                  <Button variant="ghost" size="sm" disabled className="gap-2">
                    <Settings2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Configure</span>
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
