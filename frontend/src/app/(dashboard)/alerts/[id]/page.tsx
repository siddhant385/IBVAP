import { createClient } from '@/utils/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, Info, MapPin } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BBoxOverlay } from '@/components/alerts/BBoxOverlay'

export default async function AlertInvestigationPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()

  const resolvedParams = await params

  // 1. Fetch Alert & Relations
  const { data: alert, error } = await supabase
    .from('alerts')
    .select(`
      *,
      devices ( name, location ),
      cameras ( name )
    `)
    .eq('id', resolvedParams.id)
    .single()

  if (error || !alert) {
    notFound()
  }

  // 2. Fetch Detections
  const { data: detections } = await supabase
    .from('detections')
    .select('*')
    .eq('alert_id', resolvedParams.id)

  // 3. Fetch Evidence URL (Signed URL if private, or public URL)
  let imageUrl = null
  if (alert.has_evidence && alert.evidence_path) {
    const { data, error } = await supabase.storage.from('evidence').createSignedUrl(alert.evidence_path, 3600) // 1 hour expiry
    if (data) {
      imageUrl = data.signedUrl
    } else {
      console.error('Failed to create signed URL:', error)
      imageUrl = 'https://images.unsplash.com/photo-1558231221-a3f721524e9f?q=80&w=1200&auto=format&fit=crop'
    }
  } else {
    // Fallback placeholder for demonstration
    imageUrl = 'https://images.unsplash.com/photo-1558231221-a3f721524e9f?q=80&w=1200&auto=format&fit=crop'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/alerts" className="rounded-md p-2 hover:bg-muted text-muted-foreground transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Alert Investigation</h2>
          <p className="text-muted-foreground">
            {new Date(alert.timestamp).toLocaleString()}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          {alert.processed && <Badge variant="secondary" className="bg-green-500/10 text-green-500">AI Processed</Badge>}
          <Badge variant="outline">{alert.devices?.name}</Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Evidence Viewer */}
        <Card className="lg:col-span-2 overflow-hidden border-border/50">
          <CardHeader className="bg-muted/50 py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <VideoIcon className="h-4 w-4 text-muted-foreground" />
              Captured Frame
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 bg-black">
            <BBoxOverlay imageUrl={imageUrl} detections={detections || []} />
          </CardContent>
        </Card>

        {/* Metadata & Context */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="h-4 w-4" />
                Context
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Device</div>
                  <div className="font-medium">{alert.devices?.name}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Location</div>
                  <div className="font-medium flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    {alert.devices?.location}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Camera</div>
                  <div className="font-medium">{alert.cameras?.name || 'Main'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Total Detections</div>
                  <div className="font-medium">{alert.detection_count}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Identified Objects</CardTitle>
              <CardDescription>AI classifications from ONNX payload.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {detections?.map((det) => (
                  <div key={det.id} className="flex items-center justify-between rounded-md border border-border/50 p-3 bg-muted/20">
                    <div className="flex flex-col">
                      <span className="font-medium capitalize">{det.class_name || det.feature.replace('_', ' ')}</span>
                      <span className="text-xs text-muted-foreground">Feature: {det.feature}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-bold text-primary">{(det.confidence! * 100).toFixed(1)}%</span>
                      {det.tracker_id && <span className="text-xs text-muted-foreground">ID: {det.tracker_id}</span>}
                    </div>
                  </div>
                ))}
                {!detections?.length && (
                  <div className="text-sm text-muted-foreground text-center py-4">No specific bounding boxes logged.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function VideoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
    </svg>
  )
}
