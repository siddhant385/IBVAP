'use client'

import { THREAT_COLORS } from './lib'
import { useFilteredDetections } from './useFilteredDetections'
import { useGodsEyeStore } from './store'

export function GodsEyeLegend() {
  const visibleDetections = useFilteredDetections()
  const cameras = useGodsEyeStore((s) => s.cameras)
  const zones = useGodsEyeStore((s) => s.zones)

  const activeNodesCount = cameras.filter((c) => c.is_online).length
  const totalDetectionsCount = visibleDetections.length
  const activeZoneCount = zones.length

  return (
    <div className="absolute bottom-3 left-3 z-[400] bg-background/90 backdrop-blur border border-border/60 rounded-md p-3 text-[10px] space-y-2 shadow-lg min-w-[170px]">
      <div className="space-y-1 pb-1 border-b border-border/40">
        <p className="font-semibold text-foreground text-xs">Tactical Spatial Telemetry</p>
        <div className="flex justify-between text-muted-foreground">
          <span>Active Nodes:</span>
          <span className="font-mono font-semibold text-foreground">{activeNodesCount} / {cameras.length}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Visible Spatial Pings:</span>
          <span className="font-mono font-semibold text-foreground">{totalDetectionsCount}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Monitored Perimeter Zones:</span>
          <span className="font-mono font-semibold text-foreground">{activeZoneCount}</span>
        </div>
      </div>

      <p className="font-semibold text-foreground">Threat Levels</p>
      {(['critical', 'high', 'medium', 'low'] as const).map((t) => (
        <div key={t} className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: THREAT_COLORS[t] }} />
            <span className="capitalize text-muted-foreground">{t}</span>
          </div>
          <span className="font-mono text-muted-foreground">
            {visibleDetections.filter((d) => d.threat === t).length}
          </span>
        </div>
      ))}
      <div className="border-t border-border/40 pt-1 space-y-1">
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" /><span className="text-muted-foreground">Node Online</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-500" /><span className="text-muted-foreground">Node Offline</span></div>
      </div>
    </div>
  )
}
