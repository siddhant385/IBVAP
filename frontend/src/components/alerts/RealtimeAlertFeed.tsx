'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, ShieldAlert, CheckCircle2, AlertTriangle, EyeOff } from 'lucide-react'
import { Database } from '@/types/database.types'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'

type Alert = Database['public']['Tables']['alerts']['Row'] & {
  devices: { name: string | null } | null
}

export function RealtimeAlertFeed() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [supabase] = useState(() => createClient())
  
  // Audio ref for chime
  const chimeRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    // Create an audio element pointing to a generic notification sound (using base64 or valid URL)
    chimeRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
    
    const fetchInitial = async () => {
      const { data } = await supabase
        .from('alerts')
        .select('*, devices(name)')
        .order('timestamp', { ascending: false })
        .limit(50) // Fetch a decent chunk for both tabs
      
      if (data) setAlerts(data as Alert[])
    }

    fetchInitial()

    const channel = supabase
      .channel('public:alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts' },
        async (payload) => {
          const { data: device } = await supabase
            .from('devices')
            .select('name')
            .eq('id', payload.new.device_id)
            .single()

          const newAlert = {
            ...payload.new,
            devices: device
          } as Alert

          // Play chime for critical alerts
          if (newAlert.severity === 'critical') {
            chimeRef.current?.play().catch(e => console.log('Audio autoplay blocked', e))
          }

          setAlerts((current) => [newAlert, ...current].slice(0, 100))
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'alerts' },
        (payload) => {
          // Update the alert in the list if its status changes
          setAlerts((current) => 
            current.map(a => a.id === payload.new.id ? { ...a, ...payload.new } : a)
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const handleTriage = useCallback(async (alertId: string, status: 'resolved' | 'false_positive') => {
    // Optimistic UI update
    setAlerts(current => 
      current.map(a => a.id === alertId ? { ...a, status } : a)
    )

    // Perform actual update
    const { data: userResponse } = await supabase.auth.getUser()
    const operatorId = userResponse?.user?.id || null

    await supabase
      .from('alerts')
      .update({ status, operator_id: operatorId })
      .eq('id', alertId)
  }, [supabase])

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertCircle className="h-5 w-5 text-destructive" />
      case 'warning': return <AlertTriangle className="h-5 w-5 text-orange-500" />
      default: return <InfoIcon className="h-5 w-5 text-blue-500" />
    }
  }

  // Filter alerts for the "Action Required" tab (unacknowledged/investigating + warning/critical)
  const actionRequiredAlerts = alerts.filter(a => 
    (a.status === 'unacknowledged' || a.status === 'investigating') &&
    (a.severity === 'warning' || a.severity === 'critical')
  )

  // Filter for the activity log (everything else, or simply all alerts)
  const activityLogAlerts = alerts

  return (
    <Card className="flex flex-col h-[600px] border-border/50">
      <CardHeader className="bg-muted/30 border-b border-border/50 py-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldAlert className="h-5 w-5 text-destructive animate-pulse" />
            Live Threat Feed
          </CardTitle>
          {actionRequiredAlerts.length > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              {actionRequiredAlerts.length} Action Required
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <Tabs defaultValue="action-required" className="flex-1 flex flex-col">
        <div className="px-4 border-b border-border/50">
          <TabsList className="w-full grid grid-cols-2 bg-transparent h-12">
            <TabsTrigger 
              value="action-required" 
              className="data-[state=active]:bg-muted data-[state=active]:text-foreground rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              Action Required ({actionRequiredAlerts.length})
            </TabsTrigger>
            <TabsTrigger 
              value="activity-log"
              className="data-[state=active]:bg-muted data-[state=active]:text-foreground rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
            >
              Activity Log
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ACTION REQUIRED TAB */}
        <TabsContent value="action-required" className="flex-1 overflow-y-auto p-0 m-0">
          <div className="divide-y divide-border/50">
            {actionRequiredAlerts.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                <CheckCircle2 className="h-10 w-10 text-green-500/50 mb-2" />
                No pending critical alerts.
              </div>
            ) : (
              actionRequiredAlerts.map((alert) => (
                <div 
                  key={alert.id} 
                  className={`flex flex-col gap-3 p-4 hover:bg-muted/20 transition-colors animate-in fade-in slide-in-from-top-2 ${
                    alert.severity === 'critical' ? 'bg-destructive/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`mt-1 rounded-full p-2 ${alert.severity === 'critical' ? 'bg-destructive/10' : 'bg-orange-500/10'}`}>
                      {getAlertIcon(alert.severity)}
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
                        <Badge variant={alert.severity === 'critical' ? 'destructive' : 'default'} className={alert.severity === 'warning' ? 'bg-orange-500 hover:bg-orange-600' : ''}>
                          {alert.severity.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/20">
                    <Button variant="outline" size="sm" className="h-8 gap-1 text-muted-foreground hover:text-foreground" onClick={() => handleTriage(alert.id, 'false_positive')}>
                      <EyeOff className="h-3.5 w-3.5" /> False Alarm
                    </Button>
                    <Button variant="default" size="sm" className="h-8 gap-1" onClick={() => handleTriage(alert.id, 'resolved')}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* ACTIVITY LOG TAB */}
        <TabsContent value="activity-log" className="flex-1 overflow-y-auto p-0 m-0">
          <div className="divide-y divide-border/50">
            {activityLogAlerts.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No alerts recorded.</div>
            ) : (
              activityLogAlerts.map((alert) => (
                <div 
                  key={alert.id} 
                  className="flex items-start gap-4 p-4 hover:bg-muted/20 transition-colors opacity-80"
                >
                  <div className="mt-1 rounded-full bg-muted p-2">
                    {getAlertIcon(alert.severity || 'info')}
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
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{alert.status}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {alert.detection_count} detections
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  )
}

function InfoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  )
}
