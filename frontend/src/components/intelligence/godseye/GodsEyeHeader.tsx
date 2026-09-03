'use client'

import { useGodsEyeStore } from './store'
import { THREAT_COLORS, WINDOW_MS, type TimeWindow } from './lib'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Eye, Pause, Play, RefreshCw } from 'lucide-react'
import { useFilteredDetections } from './useFilteredDetections'

export function GodsEyeHeader() {
  const playing = useGodsEyeStore((s) => s.playing)
  const timeWindow = useGodsEyeStore((s) => s.timeWindow)
  const setTimeWindow = useGodsEyeStore((s) => s.setTimeWindow)
  const togglePlaying = useGodsEyeStore((s) => s.togglePlaying)
  const clear = useGodsEyeStore((s) => s.clearDetections)
  const visible = useFilteredDetections()
  const criticalCount = visible.filter((d) => d.threat === 'critical').length

  return (
    <div className="flex items-center justify-between gap-2">
      <div>
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" />
          God&apos;s Eye View
          {criticalCount > 0 && (
            <Badge variant="destructive" className="ml-1 animate-pulse">
              {criticalCount} critical
            </Badge>
          )}
        </h2>
        <p className="text-xs text-muted-foreground">{visible.length} events in last {timeWindow}</p>
      </div>
      <div className="flex items-center gap-1">
        {(Object.keys(WINDOW_MS) as TimeWindow[]).map((w) => (
          <Button
            key={w}
            size="sm"
            variant={timeWindow === w ? 'default' : 'ghost'}
            onClick={() => setTimeWindow(w)}
            className="h-7 px-2 text-xs"
          >
            {w}
          </Button>
        ))}
        <div className="w-px h-5 bg-border mx-1" />
        <Button size="sm" variant="outline" onClick={togglePlaying}>
          {playing ? <><Pause className="h-3.5 w-3.5 mr-1" /> Pause</> : <><Play className="h-3.5 w-3.5 mr-1" /> Resume</>}
        </Button>
        <Button size="sm" variant="outline" onClick={clear}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Clear
        </Button>
      </div>
    </div>
  )
}

export { THREAT_COLORS }
