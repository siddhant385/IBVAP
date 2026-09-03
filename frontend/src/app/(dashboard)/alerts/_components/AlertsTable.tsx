'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AlertCircle, AlertTriangle, ShieldCheck, CornerDownLeft } from 'lucide-react'

interface AlertRecord {
  id: string
  timestamp: string
  severity?: string
  status?: string
  raw_payload?: { feature?: string }
  detections?: { feature?: string }[]
  devices?: { name?: string | null; location?: string | null }
  face_results?: unknown[]
  anpr_results?: { is_flagged?: boolean }[]
}

interface AlertsTableProps {
  alerts: AlertRecord[]
}

export function AlertsTable({ alerts }: AlertsTableProps) {
  const router = useRouter()
  const [selectedIndex, setSelectedIndex] = useState<number>(0)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keyboard shortcuts if user is typing in an input or select
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return
      }

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(alerts.length - 1, prev + 1))
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(0, prev - 1))
      } else if (e.key === 'Enter' && alerts[selectedIndex]) {
        e.preventDefault()
        router.push(`/alerts/${alerts[selectedIndex].id}`)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [alerts, selectedIndex, router])

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'critical':
        return <Badge variant="destructive" className="flex gap-1 w-max"><AlertCircle className="size-3" /> Critical</Badge>
      case 'warning':
        return <Badge variant="default" className="bg-orange-500 hover:bg-orange-600 flex gap-1 w-max"><AlertTriangle className="size-3" /> Warning</Badge>
      default:
        return <Badge variant="secondary" className="flex gap-1 w-max"><ShieldCheck className="size-3" /> Info</Badge>
    }
  }

  const getStatusBadge = (stat: string) => {
    switch (stat) {
      case 'unacknowledged':
        return <Badge variant="outline" className="border-orange-500/50 text-orange-500 w-max">Unacknowledged</Badge>
      case 'resolved':
        return <Badge variant="outline" className="border-green-500/50 text-green-500 w-max">Resolved</Badge>
      case 'false_positive':
        return <Badge variant="outline" className="text-muted-foreground w-max">False Alarm</Badge>
      case 'investigating':
        return <Badge variant="outline" className="border-blue-500/50 text-blue-500 w-max">Investigating</Badge>
      default:
        return <Badge variant="outline" className="w-max">{stat}</Badge>
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>Use <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50 text-[10px] font-mono">↑</kbd> <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50 text-[10px] font-mono">↓</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50 text-[10px] font-mono">J</kbd> <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50 text-[10px] font-mono">K</kbd> to navigate</span>
        <span>Press <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50 text-[10px] font-mono">Enter ↵</kbd> to investigate selected alert</span>
      </div>

      <Card className="border-border/50 overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[180px]">Timestamp</TableHead>
              <TableHead>Trigger Feature</TableHead>
              <TableHead>Location / Device</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Watchlist Matches</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alerts?.map((alert, index) => {
              const hasFaceMatch = Boolean(alert.face_results && alert.face_results.length > 0)
              const hasPlateMatch = Boolean(alert.anpr_results?.some((r) => r.is_flagged))
              const isSelected = index === selectedIndex

              return (
                <TableRow
                  key={alert.id}
                  onClick={() => router.push(`/alerts/${alert.id}`)}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? 'bg-primary/10 hover:bg-primary/15 border-l-4 border-l-primary' : 'hover:bg-muted/20'
                  }`}
                >
                  <TableCell>
                    <div className="font-medium text-sm">{new Date(alert.timestamp).toLocaleDateString()}</div>
                    <div className="text-xs text-muted-foreground font-mono">{new Date(alert.timestamp).toLocaleTimeString()}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize font-medium">
                      {(alert.raw_payload?.feature || alert.detections?.[0]?.feature || 'Security Event').replace('_', ' ')}
                    </Badge>
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
                    {isSelected && (
                      <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
                        Open <CornerDownLeft className="size-3" />
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
            {!alerts?.length && (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
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
