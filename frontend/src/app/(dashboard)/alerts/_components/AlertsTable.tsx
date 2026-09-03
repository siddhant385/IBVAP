import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AlertCircle, AlertTriangle, ShieldCheck, ExternalLink } from 'lucide-react'

interface AlertsTableProps {
  alerts: any[]
}

export function AlertsTable({ alerts }: AlertsTableProps) {
  const getSeverityBadge = (sev: string) => {
    switch(sev) {
      case 'critical': return <Badge variant="destructive" className="flex gap-1 w-max"><AlertCircle className="size-3" /> Critical</Badge>
      case 'warning': return <Badge variant="default" className="bg-orange-500 hover:bg-orange-600 flex gap-1 w-max"><AlertTriangle className="size-3" /> Warning</Badge>
      default: return <Badge variant="secondary" className="flex gap-1 w-max"><ShieldCheck className="size-3" /> Info</Badge>
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
    <Card className="border-border/50 overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-[180px]">Timestamp</TableHead>
            <TableHead>Location / Device</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Watchlist & Detection Matches</TableHead>
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
                  <div className="font-medium text-sm">{new Date(alert.timestamp).toLocaleDateString()}</div>
                  <div className="text-xs text-muted-foreground font-mono">{new Date(alert.timestamp).toLocaleTimeString()}</div>
                </TableCell>
                <TableCell>
                  <div className="font-medium text-sm">{alert.devices?.name || 'Unknown Node'}</div>
                  <div className="text-xs text-muted-foreground">{alert.devices?.location || 'Unassigned'}</div>
                </TableCell>
                <TableCell>
                  {getSeverityBadge(alert.severity || 'info')}
                </TableCell>
                <TableCell>
                  {getStatusBadge(alert.status || 'unacknowledged')}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {hasFaceMatch && <Badge variant="destructive" className="bg-red-600 animate-pulse text-xs">Flagged Face</Badge>}
                    {hasPlateMatch && <Badge variant="destructive" className="bg-orange-600 animate-pulse text-xs">Flagged Plate</Badge>}
                    {!hasFaceMatch && !hasPlateMatch && <span className="text-muted-foreground text-xs">-</span>}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/alerts/${alert.id}`}>
                    <Button variant="ghost" size="sm" className="gap-1 text-xs">
                      <ExternalLink className="size-3" /> Investigate
                    </Button>
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
  )
}
