'use client'

import { THREAT_COLORS } from './lib'

export function GodsEyeLegend() {
  return (
    <div className="absolute bottom-3 left-3 z-[400] bg-background/85 backdrop-blur border border-border/60 rounded-md p-2.5 text-[10px] space-y-1 shadow-lg">
      <p className="font-semibold text-foreground mb-1.5">Threat Levels</p>
      {(['critical', 'high', 'medium', 'low'] as const).map((t) => (
        <div key={t} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: THREAT_COLORS[t] }} />
          <span className="capitalize text-muted-foreground">{t}</span>
        </div>
      ))}
      <div className="border-t border-border/40 pt-1 mt-1.5 space-y-1">
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" /><span className="text-muted-foreground">Online</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-500" /><span className="text-muted-foreground">Offline</span></div>
      </div>
    </div>
  )
}
