'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, ShieldAlert, CheckCircle2, AlertTriangle, EyeOff, Info } from 'lucide-react'
import { Database } from '@/types/database.types'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

type Alert = Database['public']['Tables']['alerts']['Row'] & {
  devices: { name: string | null; location: string | null } | null
}

export function RealtimeAlertFeed() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const PAGE_SIZE = 50
  const [supabase] = useState(() => createClient())
  const chimeRef = useRef<HTMLAudioElement | null>(null)
  const router = useRouter()

  useEffect(() => {
    chimeRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
    
    const fetchInitial = async () => {
      const { data } = await supabase
        .from('alerts')
        .select('*, devices(name, location)')
        .order('timestamp', { ascending: false })
        .limit(PAGE_SIZE + 1)
      
      if (data) {
        setHasMore(data.length > PAGE_SIZE)
        setAlerts((data.slice(0, PAGE_SIZE) as Alert[]))
      }
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
            .select('name, location')
            .eq('id', payload.new.device_id)
            .single()

          const newAlert = {
            ...payload.new,
            devices: device
          } as Alert

          if (newAlert.severity === 'critical') {
            chimeRef.current?.play().catch(e => console.log('Audio autoplay blocked', e))
          }

          setAlerts((current) => [newAlert, ...current])
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'alerts' },
        (payload) => {
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

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || alerts.length === 0) return
    setLoadingMore(true)
    const oldest = alerts[alerts.length - 1]
    const { data } = await supabase
      .from('alerts')
      .select('*, devices(name, location)')
      .order('timestamp', { ascending: false })
      .lt('timestamp', oldest.timestamp)
      .limit(PAGE_SIZE + 1)
    if (data) {
      setHasMore(data.length > PAGE_SIZE)
      setAlerts((prev) => [...prev, ...(data.slice(0, PAGE_SIZE) as Alert[])])
    }
    setLoadingMore(false)
  }, [alerts, hasMore, loadingMore, supabase])

  const handleTriage = useCallback(async (e: React.MouseEvent, alertId: string, status: 'resolved' | 'false_positive') => {
    e.stopPropagation() // Prevent row click from navigating when pressing triage buttons
    setAlerts(current => 
      current.map(a => a.id === alertId ? { ...a, status } : a)
    )

    const { data: userResponse } = await supabase.auth.getUser()
    const operatorId = userResponse?.user?.id || null

    await supabase
      .from('alerts')
      .update({ status, operator_id: operatorId, resolved_at: new Date().toISOString() })
      .eq('id', alertId)
  }, [supabase])

  const getAlertIcon = (severity: string | null) => {
    switch (severity) {
      case 'critical': return <AlertCircle className="size-5 text-destructive" />
      case 'warning': return <AlertTriangle className="size-5 text-orange-500" />
      default: return <Info className="size-5 text-blue-500" />
    }
  }

  const actionRequiredAlerts = alerts.filter(a => 
    (a.status === 'unacknowledged' || a.status === 'investigating') &&
    (a.severity === 'warning' || a.severity === 'critical')
  )

  return (
    <Card className="flex flex-col h-[500px] max-h-[500px] border-border/50">
      <CardHeader className="bg-muted/30 border-b border-border/50 py-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldAlert className="size-5 text-destructive animate-pulse" />
            Live Threat Stream
          </CardTitle>
          {actionRequiredAlerts.length > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              {actionRequiredAlerts.length} Action Required
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <Tabs defaultValue="action-required" className="flex-1 flex flex-col min-h-0">
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
              Recent Feed ({alerts.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="action-required" className="flex-1 overflow-y-auto p-0 m-0">
          <div className="divide-y divide-border/50">
            {actionRequiredAlerts.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                <CheckCircle2 className="size-10 text-green-500/50 mb-2" />
                No pending critical alerts. Everything clear!
              </div>
            ) : (
              actionRequiredAlerts.map((alert) => (
                <div 
                  key={alert.id} 
                  onClick={() => router.push(`/alerts/${alert.id}`)}
                  className={`flex flex-col gap-3 p-4 hover:bg-muted/20 cursor-pointer transition-colors ${
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
                        <span className="text-xs text-muted-foreground font-mono">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Location: {alert.devices?.location || 'Unspecified'}
                      </p>
                      <div className="flex gap-2 mt-2">
                        {alert.has_evidence && (
                          <Badge variant="outline" className="text-xs border-primary/50 text-primary">Evidence Available</Badge>
                        )}
                        <Badge variant={alert.severity === 'critical' ? 'destructive' : 'default'} className={alert.severity === 'warning' ? 'bg-orange-500 hover:bg-orange-600' : ''}>
                          {(alert.severity || 'info').toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/20">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 gap-1 text-xs text-muted-foreground" 
                      onClick={(e) => handleTriage(e, alert.id, 'false_positive')}
                    >
                      <EyeOff className="size-3.5" /> False Alarm
                    </Button>
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="h-8 gap-1 text-xs" 
                      onClick={(e) => handleTriage(e, alert.id, 'resolved')}
                    >
                      <CheckCircle2 className="size-3.5" /> Resolve
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="activity-log" className="flex-1 overflow-y-auto p-0 m-0">
          <div className="divide-y divide-border/50">
            {alerts.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No alerts recorded.</div>
            ) : (
              <>
                {alerts.map((alert) => (
                  <div 
                    key={alert.id} 
                    onClick={() => router.push(`/alerts/${alert.id}`)}
                    className="flex items-center justify-between p-4 hover:bg-muted/20 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-muted p-2">
                        {getAlertIcon(alert.severity)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {alert.devices?.name || 'Unknown Device'}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px] uppercase">{alert.status}</Badge>
                          <span className="text-xs text-muted-foreground">{alert.devices?.location}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground font-mono">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="p-3 flex justify-center">
                  {hasMore ? (
                    <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                      {loadingMore ? 'Loading...' : `Load older (${PAGE_SIZE} more)`}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground py-2">End of history</span>
                  )}
                </div>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  )
}
