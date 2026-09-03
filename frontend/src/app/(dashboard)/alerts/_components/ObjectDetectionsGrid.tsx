import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Cpu, Target, User, Car, ShieldAlert, Activity } from 'lucide-react'

interface DetectionItem {
  id: string
  feature: string
  class_name: string | null
  confidence: number | null
  tracker_id: number | null
  bbox_xyxy: number[] | null
}

interface Props {
  detections: DetectionItem[]
}

export function ObjectDetectionsGrid({ detections }: Props) {
  const getObjectIcon = (className: string | null) => {
    switch (className?.toLowerCase()) {
      case 'person': return <User className="size-4 text-blue-400" />
      case 'car':
      case 'vehicle': return <Car className="size-4 text-emerald-400" />
      default: return <Target className="size-4 text-purple-400" />
    }
  }

  const getConfidenceBadgeColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
    if (confidence >= 0.6) return 'bg-orange-500/10 text-orange-500 border-orange-500/30'
    return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Cpu className="size-4 text-primary" /> Edge Detection Telemetry ({detections.length})
        </h3>
      </div>

      {detections.length === 0 ? (
        <div className="col-span-full text-muted-foreground p-6 bg-muted/10 rounded-lg text-center text-sm border border-border/50">
          No individual bounding box detections recorded for this frame.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {detections.map((det) => {
            const confPercent = Math.round((det.confidence || 0) * 100)
            const featureLabel = (det.feature || 'detection').replace('_', ' ')

            return (
              <Card key={det.id} className="border-border/50 bg-card hover:bg-muted/10 transition-colors">
                <CardContent className="p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-muted/50">
                        {getObjectIcon(det.class_name)}
                      </div>
                      <span className="font-semibold text-sm capitalize text-foreground">
                        {det.class_name || det.feature}
                      </span>
                    </div>
                    <Badge variant="outline" className={`text-[11px] font-mono ${getConfidenceBadgeColor(det.confidence || 0)}`}>
                      {confPercent}% Match
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/30 text-muted-foreground">
                    <div>
                      <span className="text-[10px] uppercase text-muted-foreground block">Feature Pipeline</span>
                      <span className="font-medium text-foreground capitalize">{featureLabel}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase text-muted-foreground block">Tracker ID</span>
                      <span className="font-mono font-medium text-foreground">
                        {det.tracker_id !== null ? `#${det.tracker_id}` : 'N/A'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
