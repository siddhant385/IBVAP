'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X, Search, Calendar, AlertTriangle, ShieldCheck, Cpu, Layers } from 'lucide-react'

interface Props {
  devices: { id: string; name: string | null }[]
  currentParams: Record<string, string>
}

export function AlertsFilterBar({ devices, currentParams }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(currentParams)
    if (value && value !== 'all') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`/alerts?${params.toString()}`)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateFilter('q', search)
  }

  const clearFilters = () => {
    setSearch('')
    router.push('/alerts')
  }

  const removeFilterKey = (key: string) => {
    if (key === 'q') setSearch('')
    updateFilter(key, '')
  }

  const activeKeys = Object.keys(currentParams).filter((k) => currentParams[k] && currentParams[k] !== 'all')

  return (
    <div className="space-y-3 bg-card p-3.5 rounded-lg border border-border/50">
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Real-time Free Text Search */}
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[200px] relative">
          <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search event ID, node, or feature..."
            className="pl-8 h-8 text-xs bg-muted/20 border-border/50"
          />
        </form>

        {/* Date Range */}
        <Select defaultValue={currentParams.date || 'all'} onValueChange={(val) => updateFilter('date', val || '')}>
          <SelectTrigger className="w-[140px] h-8 text-xs gap-1.5">
            <Calendar className="size-3 text-muted-foreground shrink-0" />
            <SelectValue placeholder="Date: Any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Date: Any Time</SelectItem>
            <SelectItem value="today">Date: Today</SelectItem>
            <SelectItem value="week">Date: Last 7 Days</SelectItem>
          </SelectContent>
        </Select>

        {/* Severity */}
        <Select defaultValue={currentParams.severity || 'all'} onValueChange={(val) => updateFilter('severity', val || '')}>
          <SelectTrigger className="w-[140px] h-8 text-xs gap-1.5">
            <AlertTriangle className="size-3 text-muted-foreground shrink-0" />
            <SelectValue placeholder="Severity: Any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Severity: Any</SelectItem>
            <SelectItem value="critical">Critical Only</SelectItem>
            <SelectItem value="warning">Warning Only</SelectItem>
            <SelectItem value="info">Info Only</SelectItem>
          </SelectContent>
        </Select>

        {/* Status */}
        <Select defaultValue={currentParams.status || 'all'} onValueChange={(val) => updateFilter('status', val || '')}>
          <SelectTrigger className="w-[150px] h-8 text-xs gap-1.5">
            <ShieldCheck className="size-3 text-muted-foreground shrink-0" />
            <SelectValue placeholder="Status: Any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Status: Any</SelectItem>
            <SelectItem value="unacknowledged">Unacknowledged</SelectItem>
            <SelectItem value="investigating">Investigating</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="false_positive">False Alarm</SelectItem>
          </SelectContent>
        </Select>

        {/* Target Class Filter */}
        <Select defaultValue={currentParams.class || 'all'} onValueChange={(val) => updateFilter('class', val || '')}>
          <SelectTrigger className="w-[140px] h-8 text-xs gap-1.5">
            <Layers className="size-3 text-muted-foreground shrink-0" />
            <SelectValue placeholder="Class: Any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Class: Any</SelectItem>
            <SelectItem value="person">Person</SelectItem>
            <SelectItem value="car">Vehicle / Car</SelectItem>
            <SelectItem value="backpack">Baggage</SelectItem>
          </SelectContent>
        </Select>

        {/* Edge Device Node */}
        <Select defaultValue={currentParams.device || 'all'} onValueChange={(val) => updateFilter('device', val || '')}>
          <SelectTrigger className="w-[150px] h-8 text-xs gap-1.5">
            <Cpu className="size-3 text-muted-foreground shrink-0" />
            <SelectValue placeholder="Node: Any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Node: Any Device</SelectItem>
            {devices.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name || d.id}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Active Filter Pills Bar */}
      {activeKeys.length > 0 && (
        <div className="flex items-center gap-1.5 pt-2 border-t border-border/30 text-xs">
          <span className="text-muted-foreground text-[11px] font-medium mr-1">Active Filters:</span>
          {activeKeys.map((key) => {
            let label = `${key}: ${currentParams[key]}`
            if (key === 'device') {
              const dev = devices.find((d) => d.id === currentParams[key])
              label = `Node: ${dev?.name || currentParams[key]}`
            }

            return (
              <Badge key={key} variant="secondary" className="gap-1 text-[10px] py-0.5 px-2 font-mono uppercase bg-muted">
                {label}
                <button onClick={() => removeFilterKey(key)} className="hover:text-destructive">
                  <X className="size-3" />
                </button>
              </Badge>
            )
          })}

          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 text-[10px] ml-auto text-muted-foreground hover:text-foreground">
            Clear All
          </Button>
        </div>
      )}
    </div>
  )
}
