'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, ShieldAlert } from 'lucide-react'
import { Database } from '@/types/database.types'
import { Badge } from '@/components/ui/badge'

type Alert = Database['public']['Tables']['alerts']['Row'] & {
  devices: { name: string | null } | null
}

export function RealtimeAlertFeed() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  // We need to use state for the supabase client so it's not recreated on every render
  const [supabase] = useState(() => createClient())

  useEffect(() => {
    // Fetch initial latest alerts
    const fetchInitial = async () => {
      const { data } = await supabase
        .from('alerts')
        .select('*, devices(name)')
        .order('timestamp', { ascending: false })
        .limit(10)
      
      if (data) setAlerts(data as Alert[])
    }

    fetchInitial()

    // Subscribe to realtime inserts
    const channel = supabase
      .channel('public:alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts' },
        async (payload) => {
          // Fetch the associated device name for the new alert
          const { data: device } = await supabase
            .from('devices')
            .select('name')
            .eq('id', payload.new.device_id)
            .single()

          const newAlert = {
            ...payload.new,
            devices: device
          } as Alert

          setAlerts((current) => [newAlert, ...current].slice(0, 50)) // Keep last 50
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const getAlertIcon = () => {
    // Basic logic, could be expanded based on related 'detections'
    return <AlertCircle className="h-5 w-5 text-destructive" />
  }

  return (
    <Card className="flex flex-col h-[600px] border-border/50">
      <CardHeader className="bg-muted/30 border-b border-border/50 py-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldAlert className="h-5 w-5 text-destructive animate-pulse" />
          Live Threat Feed
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto p-0">
        <div className="divide-y divide-border/50">
          {alerts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No recent alerts.</div>
          ) : (
            alerts.map((alert) => (
              <div 
                key={alert.id} 
                className="flex items-start gap-4 p-4 hover:bg-muted/20 transition-colors animate-in fade-in slide-in-from-top-2"
              >
                <div className="mt-1 rounded-full bg-destructive/10 p-2">
                  {getAlertIcon()}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium leading-none text-foreground">
                      {alert.devices?.name || 'Unknown Device'}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {alert.detection_count} detections logged.
                  </p>
                  <div className="flex gap-2 mt-2">
                    {alert.has_evidence && (
                      <Badge variant="outline" className="text-xs border-primary/50 text-primary">Evidence Captured</Badge>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
