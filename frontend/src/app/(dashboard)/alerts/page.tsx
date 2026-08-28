import { createClient } from '@/utils/supabase/server'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { AlertCircle, AlertTriangle, ShieldCheck } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AlertsFilterBar } from './AlertsFilterBar'

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const params = await searchParams

  const severity = params.severity as string
  const status = params.status as string
  const deviceId = params.device as string
  const dateRange = params.date as string

  // Base query with joins
  let query = supabase
    .from('alerts')
    .select(`
      *,
      devices ( name, location ),
      cameras ( name ),
      face_results ( id ),
      anpr_results ( id, is_flagged )
    `)
    .order('timestamp', { ascending: false })
    .limit(100)

  // Apply filters
  if (severity && severity !== 'all') {
    query = query.eq('severity', severity)
  }
  if (status && status !== 'all') {
    query = query.eq('status', status)
  }
  if (deviceId && deviceId !== 'all') {
    query = query.eq('device_id', deviceId)
  }
  if (dateRange && dateRange !== 'all') {
    const now = new Date()
    if (dateRange === 'today') {
      now.setHours(0,0,0,0)
      query = query.gte('timestamp', now.toISOString())
    } else if (dateRange === 'week') {
      now.setDate(now.getDate() - 7)
      query = query.gte('timestamp', now.toISOString())
    }
  }

  const { data: alerts, error } = await query
  
  // Also fetch devices for the filter dropdown
  const { data: devices } = await supabase.from('devices').select('id, name').order('name')

  if (error) {
    console.error('Error fetching alerts:', error)
  }

  const getSeverityBadge = (sev: string) => {
    switch(sev) {
      case 'critical': return <Badge variant="destructive" className="flex gap-1 w-max"><AlertCircle className="w-3 h-3" /> Critical</Badge>
      case 'warning': return <Badge variant="default" className="bg-orange-500 hover:bg-orange-600 flex gap-1 w-max"><AlertTriangle className="w-3 h-3" /> Warning</Badge>
      default: return <Badge variant="secondary" className="flex gap-1 w-max"><ShieldCheck className="w-3 h-3" /> Info</Badge>
    }
  }

  const getStatusBadge = (stat: string) => {
    switch(stat) {
      case 'unacknowledged': return <Badge variant="outline" className="border-orange-500/50 text-orange-500 w-max">Unacknowledged</Badge>
      case 'resolved': return <Badge variant="outline" className="border-green-500/50 text-green-500 w-max">Resolved</Badge>
      case 'false_positive': return <Badge variant="outline" className="text-muted-foreground w-max">False Alarm</Badge>
      case 'investigating': return <Badge variant="outline" className="border-blue-500/50 text-blue-500 w-max">Investigating</Badge>
      default: return <Badge variant="outline" className="w-max">{stat}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Security Alerts</h2>
          <p className="text-muted-foreground">
            Investigate historical events, intrusions, and detections.
          </p>
        </div>
        
        <AlertsFilterBar devices={devices || []} currentParams={params as Record<string, string>} />
      </div>

      <Card className="border-border/50">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[180px]">Timestamp</TableHead>
              <TableHead>Location / Device</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Watchlist Matches</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alerts?.map((alert) => {
              const hasFaceMatch = alert.face_results?.length > 0
              const hasPlateMatch = alert.anpr_results?.some((r: any) => r.is_flagged)

              return (
                <TableRow key={alert.id} className="hover:bg-muted/20">
                  <TableCell>
                    <div className="font-medium">{new Date(alert.timestamp).toLocaleDateString()}</div>
                    <div className="text-xs text-muted-foreground">{new Date(alert.timestamp).toLocaleTimeString()}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{alert.devices?.name || 'Unknown'}</div>
                    <div className="text-xs text-muted-foreground">{alert.devices?.location || 'Unknown loc'}</div>
                  </TableCell>
                  <TableCell>
                    {getSeverityBadge(alert.severity || 'info')}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(alert.status || 'unacknowledged')}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {hasFaceMatch && <Badge variant="destructive" className="bg-red-600 animate-pulse">Flagged Face</Badge>}
                      {hasPlateMatch && <Badge variant="destructive" className="bg-orange-600 animate-pulse">Flagged Plate</Badge>}
                      {!hasFaceMatch && !hasPlateMatch && <span className="text-muted-foreground">-</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/alerts/${alert.id}`}>
                      <Button variant="ghost" size="sm">Investigate</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              )
            })}
            {!alerts?.length && (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  No alerts found matching the criteria.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
