'use client'

import { useRouter } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface Props {
  devices: { id: string; name: string | null }[]
  currentParams: Record<string, string>
}

export function AlertsFilterBar({ devices, currentParams }: Props) {
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
    router.push('/alerts')
  }

  const hasFilters = Object.keys(currentParams).length > 0

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-card rounded-lg border border-border/50">
      {/* Date Range */}
      <Select defaultValue={currentParams.date || 'all'} onValueChange={(val) => updateFilter('date', val || '')}>
        <SelectTrigger className="w-[130px] h-8 text-xs">
          <SelectValue placeholder="Date Range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Time</SelectItem>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="week">Last 7 Days</SelectItem>
        </SelectContent>
      </Select>

      {/* Severity */}
      <Select defaultValue={currentParams.severity || 'all'} onValueChange={(val) => updateFilter('severity', val || '')}>
        <SelectTrigger className="w-[130px] h-8 text-xs">
          <SelectValue placeholder="Severity" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Severities</SelectItem>
          <SelectItem value="critical">Critical</SelectItem>
          <SelectItem value="warning">Warning</SelectItem>
          <SelectItem value="info">Info</SelectItem>
        </SelectContent>
      </Select>

      {/* Status */}
      <Select defaultValue={currentParams.status || 'all'} onValueChange={(val) => updateFilter('status', val || '')}>
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

      {/* Object Class Filter */}
      <Select defaultValue={currentParams.class || 'all'} onValueChange={(val) => updateFilter('class', val || '')}>
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue placeholder="Object Class" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Classes</SelectItem>
          <SelectItem value="person">Person</SelectItem>
          <SelectItem value="car">Vehicle / Car</SelectItem>
          <SelectItem value="backpack">Baggage / Backpack</SelectItem>
        </SelectContent>
      </Select>

      {/* Device */}
      <Select defaultValue={currentParams.device || 'all'} onValueChange={(val) => updateFilter('device', val || '')}>
        <SelectTrigger className="w-[150px] h-8 text-xs">
          <SelectValue placeholder="All Devices" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Devices</SelectItem>
          {devices.map((d) => (
            <SelectItem key={d.id} value={d.id}>{d.name || d.id}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs ml-auto gap-1 text-muted-foreground">
          <X className="size-3" /> Clear Filters
        </Button>
      )}
    </div>
  )
}
