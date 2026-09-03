import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, ShieldAlert, User, ShieldCheck } from 'lucide-react'

interface Props {
  faceMatches: any[]
  anprMatches: any[]
  severity: string
}

export function AiThreatSynthesisBanner({ faceMatches, anprMatches, severity }: Props) {
  const hasFaceMatch = faceMatches.length > 0
  const hasPlateMatch = anprMatches.length > 0

  if (!hasFaceMatch && !hasPlateMatch && severity !== 'critical') {
    return (
      <div className="p-4 rounded-lg bg-muted/20 border border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-blue-500/10 text-blue-500">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Standard Perimeter Telemetry</p>
            <p className="text-xs text-muted-foreground">No watchlist targets matched for this frame.</p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs">Normal Risk</Badge>
      </div>
    )
  }

  return (
    <Card className="border-destructive/40 bg-destructive/5 overflow-hidden">
      <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-full bg-destructive/10 text-destructive mt-0.5">
            <ShieldAlert className="size-5 animate-pulse" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-destructive uppercase tracking-wide">
                Watchlist Threat Match Detected
              </span>
              <Badge variant="destructive" className="text-[10px]">CRITICAL RISK</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {hasFaceMatch && faceMatches[0].known_faces?.name ? (
                <>Matched suspect <strong className="text-foreground font-semibold">{faceMatches[0].known_faces.name}</strong> with {((faceMatches[0].similarity_score || 0) * 100).toFixed(1)}% vector confidence.</>
              ) : hasPlateMatch ? (
                <>Flagged vehicle plate <strong className="text-foreground font-mono font-semibold">{anprMatches[0].plate_text}</strong> identified on watchlist.</>
              ) : (
                <>Critical severity intrusion alert logged by edge detection engine.</>
              )}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
