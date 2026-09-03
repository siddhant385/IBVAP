import { createClient } from '@/utils/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Cpu, Camera, Bell, ExternalLink } from 'lucide-react'
import Link from 'next/link'

export async function NodeAlertsDistributionTable() {
  const supabase = await createClient()

  // 1. Fetch devices with count of alerts
  const { data: devices } = await supabase
    .from('devices')
    .select(`
      id,
      name,
      location,
      is_online,
      alerts ( count )
    `)
    .order('name')

  // 2. Fetch cameras with alert counts
  const { data: cameras } = await supabase
    .from('cameras')
    .select(`
      id,
      name,
      is_online,
      device_id,
      alerts ( count )
    `)
    .order('name')

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Cpu className="size-4 text-primary" /> Node Alert Volume Summary
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Distribution of historical and real-time alerts across deployed edge hardware nodes.
        </p>
      </div>

      <Card className="border-border/50 overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Edge Node / Device</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Node Status</TableHead>
              <TableHead className="text-center">Total Alerts Logged</TableHead>
              <TableHead className="text-right">Node Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices?.map((d: any) => {
              const alertCount = d.alerts?.[0]?.count || 0

              return (
                <TableRow key={d.id} className="hover:bg-muted/20">
                  <TableCell className="font-medium text-sm">
                    <div className="flex items-center gap-2">
                      <Cpu className="size-4 text-muted-foreground" />
                      <span>{d.name || 'Unnamed Edge Node'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {d.location || 'Unassigned Zone'}
                  </TableCell>
                  <TableCell>
                    {d.is_online ? (
                      <Badge variant="outline" className="border-green-500/50 text-green-500 text-[10px]">Online</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground text-[10px]">Offline</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center font-bold text-sm">
                    <span className="px-2 py-0.5 rounded bg-muted font-mono">{alertCount}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/alerts?device=${d.id}`}>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                        <Bell className="size-3" /> View Alerts
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
