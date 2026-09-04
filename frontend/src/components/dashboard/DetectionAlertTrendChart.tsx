'use client'

import { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/utils/supabase/client'

export interface HourlyTrendData {
  /** Bucket start as ISO string (UTC) */
  ts: string
  /** Local-display label like "14:00" or "Mar 5 14:00" */
  label: string
  detections: number
  alerts: number
}

type Window = '1h' | '6h' | '24h' | '7d'

const WINDOW_MS: Record<Window, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
}

const BUCKET_COUNT: Record<Window, number> = {
  '1h': 12,
  '6h': 24,
  '24h': 24,
  '7d': 28,
}

const formatLabel = (ts: number, window: Window) => {
  const d = new Date(ts)
  if (window === '7d') {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function DetectionAlertTrendChart({ initialData, initialWindow = '24h' }: { initialData: HourlyTrendData[]; initialWindow?: Window }) {
  const [data, setData] = useState<HourlyTrendData[]>(initialData)
  const [window, setWindow] = useState<Window>(initialWindow)
  const [now, setNow] = useState(() => Date.now())
  const supabase = createClient()

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Recompute live counts from the rolling window over the cached buckets
  const liveData = useMemo(() => {
    const cutoff = now - WINDOW_MS[window]
    return data.filter((b) => new Date(b.ts).getTime() + WINDOW_MS[window] / BUCKET_COUNT[window] >= cutoff)
  }, [data, window, now])

  // Subscribe to live inserts and append to the latest bucket
  useEffect(() => {
    const bucketMs = WINDOW_MS[window] / BUCKET_COUNT[window]
    const channel = supabase
      .channel('trend-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'detections' }, () => {
        setData((prev) => {
          if (prev.length === 0) return prev
          const latestTs = new Date(prev[prev.length - 1].ts).getTime()
          const bucketStart = Math.floor(now / bucketMs) * bucketMs
          if (Math.abs(latestTs - bucketStart) > bucketMs) return prev
          const idx = prev.findIndex((b) => new Date(b.ts).getTime() === bucketStart)
          if (idx === -1) return prev
          const copy = [...prev]
          copy[idx] = { ...copy[idx], detections: copy[idx].detections + 1 }
          return copy
        })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, () => {
        setData((prev) => {
          if (prev.length === 0) return prev
          const bucketMs = WINDOW_MS[window] / BUCKET_COUNT[window]
          const bucketStart = Math.floor(now / bucketMs) * bucketMs
          const idx = prev.findIndex((b) => new Date(b.ts).getTime() === bucketStart)
          if (idx === -1) return prev
          const copy = [...prev]
          copy[idx] = { ...copy[idx], alerts: copy[idx].alerts + 1 }
          return copy
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, window, now])

  // Relabel buckets when window changes (local TZ)
  const display = liveData.map((b) => ({
    ...b,
    label: formatLabel(new Date(b.ts).getTime(), window),
  }))

  const totalDetections = display.reduce((s, b) => s + b.detections, 0)
  const totalAlerts = display.reduce((s, b) => s + b.alerts, 0)
  const peakBucket = display.reduce((m, b) => (b.detections + b.alerts > (m?.detections ?? 0) + (m?.alerts ?? 0) ? b : m), display[0])

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base font-semibold">Threat & Detection Velocity</CardTitle>
            <CardDescription>
              {totalDetections.toLocaleString()} detections · {totalAlerts.toLocaleString()} alerts
              {peakBucket && ` · peak ${peakBucket.label}`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            {(['1h', '6h', '24h', '7d'] as Window[]).map((w) => (
              <Button
                key={w}
                size="sm"
                variant={window === w ? 'default' : 'ghost'}
                onClick={() => setWindow(w)}
                className="h-7 px-2 text-xs"
              >
                {w}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={display} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorDetections" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorAlerts" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.15)" />
            <XAxis dataKey="label" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={32} />
            <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '12px' }}
              labelStyle={{ color: '#94a3b8', fontWeight: 600 }}
              formatter={(value, name) => [Number(value ?? 0).toLocaleString(), String(name)]}
            />
            <Legend wrapperStyle={{ fontSize: '11px' }} iconType="circle" />
            <Area type="monotone" dataKey="detections" stroke="#3b82f6" fillOpacity={1} fill="url(#colorDetections)" name="Detections" strokeWidth={2} />
            <Area type="monotone" dataKey="alerts" stroke="#ef4444" fillOpacity={1} fill="url(#colorAlerts)" name="Alerts" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
