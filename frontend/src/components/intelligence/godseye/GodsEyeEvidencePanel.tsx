'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X, MapPin } from 'lucide-react'
import { useGodsEyeStore } from './store'
import { evidenceUrl, THREAT_COLORS } from './lib'

export function GodsEyeEvidencePanel() {
  const det = useGodsEyeStore((s) => s.selectedDetection)
  const setSelectedDetection = useGodsEyeStore((s) => s.setSelectedDetection)

  useEffect(() => {
    if (!det) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedDetection(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [det, setSelectedDetection])

  if (!det) return null
  const url = evidenceUrl(det.evidence_path)
  return (
    <div className="absolute top-3 right-3 z-[400] w-72 bg-background/95 backdrop-blur border border-border/60 rounded-md shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-border/40">
        <div>
          <p className="text-sm font-semibold capitalize">{det.feature}{det.class_name ? `: ${det.class_name}` : ''}</p>
          <p className="text-[10px] text-muted-foreground">{new Date(det.ts).toLocaleString()}</p>
        </div>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setSelectedDetection(null)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="p-3 space-y-2.5">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="evidence" className="w-full rounded border border-border/40 bg-muted" />
        ) : (
          <div className="w-full h-32 rounded border border-dashed border-border/60 flex items-center justify-center text-[10px] text-muted-foreground">
            No evidence captured
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-[10px] text-muted-foreground">Threat</p>
            <Badge variant={det.feature ? 'destructive' : 'secondary'} className="text-[10px] mt-0.5" style={{ background: THREAT_COLORS[det.feature === 'face' && (det.confidence ?? 0) > 0.85 ? 'high' : 'medium'] }}>
              {(det.class_name ?? 'object').toUpperCase()}
            </Badge>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Confidence</p>
            <p className="font-mono text-sm">{det.confidence != null ? `${(det.confidence * 100).toFixed(1)}%` : '—'}</p>
          </div>
          <div className="col-span-2">
            <p className="text-[10px] text-muted-foreground">Camera</p>
            <p className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3" />{det.camera_name ?? '—'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
