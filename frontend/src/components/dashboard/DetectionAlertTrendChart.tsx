'use client'

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

interface HourlyTrendData {
  hour: string
  detections: number
  alerts: number
}

export function DetectionAlertTrendChart({ data }: { data: HourlyTrendData[] }) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Threat & Detection Velocity (24h)</CardTitle>
        <CardDescription>Real-time correlation between object detections and raised security alerts</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 min-h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorDetections" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-1, #3b82f6)" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="var(--chart-1, #3b82f6)" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorAlerts" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--destructive, #ef4444)" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="var(--destructive, #ef4444)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="hour" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }}
            />
            <Area type="monotone" dataKey="detections" stroke="var(--chart-1, #3b82f6)" fillOpacity={1} fill="url(#colorDetections)" name="Detections" />
            <Area type="monotone" dataKey="alerts" stroke="var(--destructive, #ef4444)" fillOpacity={1} fill="url(#colorAlerts)" name="Alerts" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
