'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/utils/supabase/client'
import { VideoIcon, UserCircleIcon, CarIcon, CrosshairIcon } from '@phosphor-icons/react/dist/ssr'

export interface CameraActivity {
  id: string
  name: string
  detections: number
  alerts: number
  online: boolean
}

export interface ThreatBucket {
  level: string
  count: number
  color: string
}

export interface AnalyticsData {
  topCameras: CameraActivity[]
  threatMix: ThreatBucket[]
  featureMix: { feature: string; count: number }[]
  avgResponseMin: number | null
  resolvedCount: number
  totalAlerts: number
}

export function AnalyticsPanel({ initial, windowHours = 24 }: { initial: AnalyticsData; windowHours?: number }) {
  const [data, setData] = useState<AnalyticsData>(initial)
  const supabase = createClient()
  const [, force] = useState(0)

  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('analytics-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, () => {
        setData((prev) => ({
          ...prev,
          totalAlerts: prev.totalAlerts + 1,
        }))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'alerts' }, (payload) => {
        const r = payload.new as { status?: string }
        if (r?.status === 'resolved' || r?.status === 'false_positive') {
          setData((prev) => ({
            ...prev,
            resolvedCount: prev.resolvedCount + 1,
          }))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  const maxDet = useMemo(() => Math.max(1, ...data.topCameras.map((c) => c.detections)), [data.topCameras])
  const totalThreats = useMemo(() => data.threatMix.reduce((s, t) => s + t.count, 0), [data.threatMix])
  const resolveRate = data.totalAlerts > 0 ? Math.round((data.resolvedCount / data.totalAlerts) * 100) : 0

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <VideoIcon className="size-4 text-primary" />
            Top Active Cameras
          </CardTitle>
          <CardDescription>By detection count in last {windowHours}h</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.topCameras.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No camera activity in window.</p>
          ) : data.topCameras.map((cam) => (
            <div key={cam.id} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium truncate">
                  <span className={`size-1.5 rounded-full ${cam.online ? 'bg-green-500' : 'bg-slate-500'}`} />
                  {cam.name}
                </span>
                <span className="text-muted-foreground">
                  {cam.detections.toLocaleString()} det · {cam.alerts} alerts
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all"
                  style={{ width: `${(cam.detections / maxDet) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <CrosshairIcon className="size-4 text-primary" />
            Threat Distribution
          </CardTitle>
          <CardDescription>Active alerts by severity</CardDescription>
        </CardHeader>
        <CardContent>
          {totalThreats === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No active threats.</p>
          ) : (
            <div className="space-y-2.5">
              {data.threatMix.map((t) => {
                const pct = totalThreats > 0 ? (t.count / totalThreats) * 100 : 0
                return (
                  <div key={t.level} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium capitalize">
                        <span className="size-2 rounded-full" style={{ background: t.color }} />
                        {t.level}
                      </span>
                      <span className="text-muted-foreground">{t.count} · {pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full transition-all" style={{ width: `${pct}%`, background: t.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Detection Mix</CardTitle>
          <CardDescription>What is being detected</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.featureMix.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No data.</p>
          ) : data.featureMix.map((f) => {
            const total = data.featureMix.reduce((s, x) => s + x.count, 0)
            const pct = total > 0 ? (f.count / total) * 100 : 0
            return (
              <div key={f.feature} className="flex items-center gap-2 text-xs">
                {f.feature === 'face' ? <UserCircleIcon className="size-3.5" /> :
                 f.feature === 'plate' ? <CarIcon className="size-3.5" /> :
                 <CrosshairIcon className="size-3.5" />}
                <span className="capitalize flex-1">{f.feature}</span>
                <span className="text-muted-foreground font-mono">{f.count.toLocaleString()}</span>
                <span className="text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Response Metrics</CardTitle>
          <CardDescription>Operator performance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-[10px] text-muted-foreground">Resolve rate</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{resolveRate}%</span>
              <span className="text-xs text-muted-foreground">{data.resolvedCount} / {data.totalAlerts}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1">
              <div className="h-full bg-green-500 transition-all" style={{ width: `${resolveRate}%` }} />
            </div>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Avg response time</p>
            <p className="text-2xl font-bold">
              {data.avgResponseMin != null ? `${data.avgResponseMin.toFixed(1)}m` : '—'}
            </p>
          </div>
          <Badge variant={resolveRate > 80 ? 'default' : resolveRate > 50 ? 'secondary' : 'destructive'} className="w-full justify-center">
            {resolveRate > 80 ? 'Excellent' : resolveRate > 50 ? 'On track' : 'Needs attention'}
          </Badge>
        </CardContent>
      </Card>
    </div>
  )
}
