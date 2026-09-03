'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Camera, RefreshCw, Volume2, CheckCircle, Info, MapPin, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface Props {
  deviceId: string
  deviceName: string
  deviceLocation: string | null
  cameraId: string | null
  cameraName: string | null
}

export function AlertSidebarContext({ deviceId, deviceName, deviceLocation, cameraId, cameraName }: Props) {
  const [commandSent, setCommandSent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const sendDeviceCommand = async (command: string) => {
    setLoading(true)
    setCommandSent(null)

    const { error } = await supabase.from('device_commands').insert({
      device_id: deviceId,
      camera_id: cameraId,
      command: command,
      payload: { trigger: 'alert_investigation_manual' },
      status: 'pending',
    })

    setLoading(false)
    if (!error) {
      setCommandSent(command)
      setTimeout(() => setCommandSent(null), 4000)
    }
  }

  return (
    <div className="space-y-6">
      {/* Node Context Card */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="size-4 text-primary" /> Node Context
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Source Edge Device</div>
            <div className="font-medium p-2.5 bg-muted/20 rounded border border-border/50 flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">{deviceName}</p>
                <p className="text-[10px] font-mono text-muted-foreground">{deviceId}</p>
              </div>
              <Link href={`/infrastructure`}>
                <Button variant="ghost" size="sm" className="size-7 p-0">
                  <ExternalLink className="size-3.5" />
                </Button>
              </Link>
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground mb-1">Camera Channel</div>
            <div className="font-medium p-2.5 bg-muted/20 rounded border border-border/50 flex items-center justify-between">
              <span className="text-foreground">{cameraName || 'Main Camera Channel'}</span>
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground mb-1">Deployment Zone</div>
            <div className="font-medium flex items-center gap-1.5 p-2.5 bg-muted/20 rounded border border-border/50">
              <MapPin className="size-3.5 text-muted-foreground" />
              <span>{deviceLocation || 'Unassigned Location'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Edge Commands */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="size-4 text-primary" /> Edge Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => sendDeviceCommand('snapshot')}
            className="w-full justify-start gap-2 h-9 text-xs"
          >
            <Camera className="size-3.5 text-blue-500" /> Request Real-Time Snapshot
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => sendDeviceCommand('restart_stream')}
            className="w-full justify-start gap-2 h-9 text-xs"
          >
            <RefreshCw className="size-3.5 text-orange-500" /> Restart Camera Stream
          </Button>

          {commandSent && (
            <div className="p-2.5 rounded bg-green-500/10 border border-green-500/30 text-green-500 text-xs flex items-center gap-2 mt-2">
              <CheckCircle className="size-3.5" />
              Sent '{commandSent}' command to node.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
