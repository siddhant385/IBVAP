'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Filter, ScanSearch, ShieldAlert, Crosshair, UserCircle2, CarFront } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useGodsEyeStore } from './store'
import { useFilteredDetections } from './useFilteredDetections'
import { THREAT_COLORS, type TimeWindow, type ThreatLevel } from './lib'

export function GodsEyeSidebar() {
  const search = useGodsEyeStore((s) => s.search)
  const setSearch = useGodsEyeStore((s) => s.setSearch)
  const featureFilter = useGodsEyeStore((s) => s.featureFilter)
  const setFeatureFilter = useGodsEyeStore((s) => s.setFeatureFilter)
  const threatFilter = useGodsEyeStore((s) => s.threatFilter)
  const setThreatFilter = useGodsEyeStore((s) => s.setThreatFilter)
  const selectedCameraId = useGodsEyeStore((s) => s.selectedCameraId)
  const setSelectedCameraId = useGodsEyeStore((s) => s.setSelectedCameraId)
  const setSelectedDetection = useGodsEyeStore((s) => s.setSelectedDetection)
  const flagged = useGodsEyeStore((s) => s.flagged)
  const visible = useFilteredDetections()

  return (
    <aside className="flex flex-col gap-4 min-h-0">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Filter className="h-3.5 w-3.5" /> Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input placeholder="Search camera/class..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={featureFilter}
              onChange={(e) => setFeatureFilter(e.target.value as typeof featureFilter)}
              className="h-9 rounded-md border bg-background px-2 text-xs"
            >
              <option value="all">All features</option>
              <option value="face">Face</option>
              <option value="plate">Plate</option>
              <option value="object">Object</option>
            </select>
            <select
              value={threatFilter}
              onChange={(e) => setThreatFilter(e.target.value as typeof threatFilter)}
              className="h-9 rounded-md border bg-background px-2 text-xs"
            >
              <option value="all">All threats</option>
              {(['critical', 'high', 'medium', 'low'] as ThreatLevel[]).map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
          {selectedCameraId && (
            <Button size="sm" variant="ghost" className="w-full" onClick={() => setSelectedCameraId(null)}>
              Clear camera focus
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="flex-1 min-h-0 flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><ScanSearch className="h-3.5 w-3.5" /> Recent Activity</CardTitle>
          <CardDescription>{visible.length} events</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-1 pr-1">
          {visible.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">No detections match filters.</p>
          )}
          {visible.slice(0, 100).map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedDetection(d)}
              className="w-full text-left text-xs p-2 rounded-md border border-border/40 hover:bg-muted/40 transition"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium capitalize flex items-center gap-1">
                  {d.feature === 'face' ? <UserCircle2 className="h-3 w-3" /> :
                   d.feature === 'plate' ? <CarFront className="h-3 w-3" /> :
                   <Crosshair className="h-3 w-3" />}
                  {d.class_name ?? d.feature}
                </span>
                <Badge variant={d.threat === 'critical' ? 'destructive' : 'secondary'} className="text-[10px]">
                  {d.threat}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-muted-foreground mt-0.5">
                <span className="truncate">{d.camera_name ?? '—'}</span>
                <span className="font-mono">{d.confidence != null ? `${(d.confidence * 100).toFixed(0)}%` : '—'} · {new Date(d.ts).toLocaleTimeString()}</span>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><ShieldAlert className="h-3.5 w-3.5" /> Top Flagged</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {flagged.length === 0 && <p className="text-xs text-muted-foreground">No flagged entities.</p>}
          {flagged.slice(0, 8).map((f) => (
            <div key={`${f.kind}-${f.id}`} className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-muted/40">
              <div className="flex items-center gap-1.5">
                {f.kind === 'face' ? <UserCircle2 className="h-3.5 w-3.5" /> : <CarFront className="h-3.5 w-3.5" />}
                <span className="font-medium truncate max-w-[140px]">{f.label}</span>
              </div>
              <Badge variant={f.threat === 'critical' ? 'destructive' : 'secondary'} className="text-[10px]">
                {f.threat ?? '—'}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </aside>
  )
}

export { THREAT_COLORS, type TimeWindow }
