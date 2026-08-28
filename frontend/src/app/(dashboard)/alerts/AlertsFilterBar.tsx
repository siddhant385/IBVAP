'use client'

import { useRouter } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

export function AlertsFilterBar({ devices, currentParams }: { devices: any[], currentParams: Record<string, string> }) {
  const router = useRouter()

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(currentParams)
    if (value && value !== 'all') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`/alerts?${params.toString()}`)
  }

  const clearFilters = () => {
    router.push(`/alerts`)
  }

  const hasFilters = Object.keys(currentParams).length > 0

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-card rounded-md border border-border/50">
      <Select defaultValue={currentParams.date || 'all'} onValueChange={(val) => updateFilter('date', val)}>
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue placeholder="Date Range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Time</SelectItem>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="week">Last 7 Days</SelectItem>
        </SelectContent>
      </Select>

      <Select defaultValue={currentParams.severity || 'all'} onValueChange={(val) => updateFilter('severity', val)}>
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue placeholder="Severity" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Severities</SelectItem>
          <SelectItem value="critical">Critical</SelectItem>
          <SelectItem value="warning">Warning</SelectItem>
          <SelectItem value="info">Info</SelectItem>
        </SelectContent>
      </Select>

      <Select defaultValue={currentParams.status || 'all'} onValueChange={(val) => updateFilter('status', val)}>
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="unacknowledged">Unacknowledged</SelectItem>
          <SelectItem value="investigating">Investigating</SelectItem>
          <SelectItem value="resolved">Resolved</SelectItem>
          <SelectItem value="false_positive">False Alarm</SelectItem>
        </SelectContent>
      </Select>

      <Select defaultValue={currentParams.device || 'all'} onValueChange={(val) => updateFilter('device', val)}>
        <SelectTrigger className="w-[160px] h-8 text-xs">
          <SelectValue placeholder="All Devices" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Devices</SelectItem>
          {devices.map((d) => (
            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs ml-auto">
          <X className="h-3 w-3 mr-1" /> Clear Filters
        </Button>
      )}
    </div>
  )
}
