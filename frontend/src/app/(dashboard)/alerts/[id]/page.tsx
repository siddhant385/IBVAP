import { createClient } from '@/utils/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, Info, AlertCircle, AlertTriangle, ShieldCheck, Clock, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BBoxOverlay } from '../_components/BBoxOverlay'
import { AlertTriageActions } from '../_components/AlertTriageActions'
import { AlertSidebarContext } from '../_components/AlertSidebarContext'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ObjectDetectionsGrid } from '../_components/ObjectDetectionsGrid'
import { AlertPaginationNav } from '../_components/AlertPaginationNav'
import { AiThreatSynthesisBanner } from '../_components/AiThreatSynthesisBanner'

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

  if (error || !alert) notFound()

  // 2. Fetch Prev/Next Alert IDs for Navigation
  const { data: prevAlert } = await supabase
    .from('alerts')
    .select('id')
    .lt('timestamp', alert.timestamp)
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: nextAlert } = await supabase
    .from('alerts')
    .select('id')
    .gt('timestamp', alert.timestamp)
    .order('timestamp', { ascending: true })
    .limit(1)
    .maybeSingle()

  // 3. Fetch Detections
  const { data: detections } = await supabase
    .from('detections')
    .select('*')
    .eq('alert_id', resolvedParams.id)

  // 3. Fetch Watchlist Matches
  const { data: faceMatches } = await supabase
    .from('face_results')
    .select(`*, known_faces(name, threat_level, reference_image_path)`)
    .eq('alert_id', resolvedParams.id)

  const { data: anprMatches } = await supabase
    .from('anpr_results')
    .select(`*`)
    .eq('alert_id', resolvedParams.id)

  // 4. Fetch Evidence Signed URL
  let imageUrl = 'https://images.unsplash.com/photo-1558231221-a3f721524e9f?q=80&w=1200&auto=format&fit=crop'
  if (alert.has_evidence && alert.evidence_path) {
    const { data } = await supabase.storage.from('evidence').createSignedUrl(alert.evidence_path, 3600)
    if (data?.signedUrl) imageUrl = data.signedUrl
  }

  // 5. Fetch Face & Plate Crops Signed URLs
  const faceMatchesWithUrls = await Promise.all(
    (faceMatches || []).map(async (face) => {
      let cropUrl = null
      let refUrl = null
      if (face.face_crop_path) {
        const { data } = await supabase.storage.from('evidence').createSignedUrl(face.face_crop_path, 3600)
        if (data?.signedUrl) cropUrl = data.signedUrl
      }
      if (face.known_faces?.reference_image_path) {
        const { data } = await supabase.storage.from('watchlist').createSignedUrl(face.known_faces.reference_image_path, 3600)
        if (data?.signedUrl) refUrl = data.signedUrl
      }
      return { ...face, cropUrl, refUrl }
    })
  )

  const anprMatchesWithUrls = await Promise.all(
    (anprMatches || []).map(async (plate) => {
      let cropUrl = null
      if (plate.plate_crop_path) {
        const { data } = await supabase.storage.from('evidence').createSignedUrl(plate.plate_crop_path, 3600)
        if (data?.signedUrl) cropUrl = data.signedUrl
      }
      return { ...plate, cropUrl }
    })
  )

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'critical':
        return <Badge variant="destructive" className="flex gap-1"><AlertCircle className="size-3" /> Critical</Badge>
      case 'warning':
        return <Badge variant="default" className="bg-orange-500 flex gap-1"><AlertTriangle className="size-3" /> Warning</Badge>
      default:
        return <Badge variant="secondary" className="flex gap-1"><ShieldCheck className="size-3" /> Info</Badge>
    }
  }

  // Calculate Pipeline Latency
  let latencyMs = 0
  if (alert.received_at && alert.timestamp) {
    latencyMs = new Date(alert.received_at).getTime() - new Date(alert.timestamp).getTime()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-4">
        <div className="flex items-center gap-4">
          <Link href="/alerts" className="rounded-md p-2 hover:bg-muted text-muted-foreground transition-colors border border-border/50 bg-card">
            <ChevronLeft className="size-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight">Alert Investigation</h2>
              {getSeverityBadge(alert.severity || 'info')}
            </div>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">
              Event ID: {alert.id} • {new Date(alert.timestamp).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Live Interactive Triage Header & Next/Prev Navigation */}
        <div className="flex items-center gap-3">
          <AlertPaginationNav
            prevId={prevAlert?.id || null}
            nextId={nextAlert?.id || null}
          />
          <AlertTriageActions
            alertId={alert.id}
            initialStatus={alert.status || 'unacknowledged'}
            severity={alert.severity || 'info'}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content Area (Tabs) */}
        <div className="lg:col-span-2 space-y-4">
          <Tabs defaultValue="evidence" className="w-full">
            <TabsList className="w-full grid grid-cols-3 bg-muted/50 p-1 rounded-t-lg rounded-b-none h-12">
              <TabsTrigger value="evidence" className="data-[state=active]:bg-background">Visual Evidence</TabsTrigger>
              <TabsTrigger value="ai-insights" className="data-[state=active]:bg-background">AI Insights ({detections?.length || 0})</TabsTrigger>
              <TabsTrigger value="lifecycle" className="data-[state=active]:bg-background">Telemetry & Payload</TabsTrigger>
            </TabsList>
            
            <TabsContent value="evidence" className="mt-0">
              <Card className="rounded-t-none border-t-0 overflow-hidden">
                <CardContent className="p-0 bg-black min-h-[480px] flex items-center justify-center relative">
                  <BBoxOverlay imageUrl={imageUrl} detections={detections || []} />
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="ai-insights" className="mt-0">
              <Card className="rounded-t-none border-t-0 p-6 space-y-6 min-h-[480px]">
                {/* AI Automated Threat Assessment Banner */}
                <AiThreatSynthesisBanner
                  faceMatches={faceMatchesWithUrls}
                  anprMatches={anprMatchesWithUrls}
                  severity={alert.severity || 'info'}
                />

                {/* Watchlist Matches */}
                {(faceMatchesWithUrls.length > 0 || anprMatchesWithUrls.length > 0) && (
                  <div className="space-y-4">
                    <h3 className="text-base font-semibold flex items-center gap-2 text-destructive">
                      <ShieldAlert className="size-4" /> Watchlist Matches
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {faceMatchesWithUrls.map((face) => (
                        <Card key={face.id} className="border-destructive/30 bg-destructive/5 overflow-hidden">
                          <div className="flex h-28">
                            {/* Live Captured Crop */}
                            <div className="w-24 bg-black flex flex-col items-center justify-center border-r border-destructive/20 overflow-hidden shrink-0 relative">
                              {face.cropUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={face.cropUrl} alt="Face Crop" className="size-full object-cover" />
                              ) : (
                                <span className="text-[10px] text-muted-foreground">Crop</span>
                              )}
                              <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] text-center text-white py-0.5 font-mono">Captured</span>
                            </div>

                            {/* Reference Watchlist Image */}
                            <div className="w-24 bg-black flex flex-col items-center justify-center border-r border-destructive/20 overflow-hidden shrink-0 relative">
                              {face.refUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={face.refUrl} alt="Watchlist Reference" className="size-full object-cover" />
                              ) : (
                                <span className="text-[10px] text-muted-foreground">Reference</span>
                              )}
                              <span className="absolute bottom-0 inset-x-0 bg-destructive/80 text-[9px] text-center text-white py-0.5 font-mono">Watchlist</span>
                            </div>

                            <div className="p-3 flex-1 flex flex-col justify-center space-y-1">
                              <div className="font-bold text-sm leading-none">{face.known_faces?.name || 'Unknown Suspect'}</div>
                              <div className="text-xs text-muted-foreground flex justify-between pt-1">
                                <span>Threat Level:</span>
                                <span className="font-semibold text-destructive uppercase text-[10px]">{face.known_faces?.threat_level || 'HIGH'}</span>
                              </div>
                              <div className="text-xs text-muted-foreground flex justify-between">
                                <span>Similarity Score:</span>
                                <span className="font-semibold text-foreground font-mono">{((face.similarity_score || 0) * 100).toFixed(1)}%</span>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                      {anprMatchesWithUrls.map((plate) => (
                        <Card key={plate.id} className="border-orange-500/30 bg-orange-500/5 overflow-hidden">
                          <div className="flex h-24">
                            <div className="w-24 bg-black flex items-center justify-center border-r border-orange-500/20 overflow-hidden shrink-0">
                              {plate.cropUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={plate.cropUrl} alt="Plate Crop" className="size-full object-cover" />
                              ) : (
                                <span className="text-[10px] text-muted-foreground">Plate Crop</span>
                              )}
                            </div>
                            <div className="p-3 flex-1 flex flex-col justify-center">
                              <div className="font-bold font-mono text-base">{plate.plate_text || 'FLAGGED'}</div>
                              <div className="text-xs text-muted-foreground flex justify-between mt-1">
                                <span>Confidence:</span>
                                <span className="font-semibold text-foreground">{((plate.plate_confidence || 0) * 100).toFixed(1)}%</span>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Grouped & Individual Object Detections */}
                <ObjectDetectionsGrid detections={detections || []} />
              </Card>
            </TabsContent>
            
            <TabsContent value="lifecycle" className="mt-0">
              <Card className="rounded-t-none border-t-0 p-6 space-y-6 min-h-[480px]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm flex items-center gap-2"><Clock className="size-4" /> Pipeline Latency Timeline</h4>
                    <div className="space-y-3 relative border-l-2 border-primary/30 pl-4 ml-2">
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-foreground">1. Edge Event Generated</div>
                        <div className="text-[11px] text-muted-foreground">Node: {alert.devices?.name}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{new Date(alert.timestamp).toISOString()}</div>
                      </div>
                      <div className="space-y-1 pt-2">
                        <div className="text-xs font-semibold text-foreground">2. Cloud Ingested</div>
                        <div className="text-[11px] text-muted-foreground">Ingestion Latency: {(latencyMs / 1000).toFixed(2)}s</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{alert.received_at ? new Date(alert.received_at).toISOString() : 'N/A'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium text-sm flex items-center gap-2"><Info className="size-4" /> Triage Audit Metadata</h4>
                    <div className="p-4 rounded-md border border-border/50 bg-muted/10 space-y-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Current Status:</span>
                        <span className="font-semibold capitalize text-foreground">{alert.status}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Assigned Operator:</span>
                        <span className="font-mono text-[10px]">{alert.operator_id || 'Unassigned'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-border/50">
                  <details className="group">
                    <summary className="cursor-pointer py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                      View Raw Telemetry Payload
                    </summary>
                    <pre className="p-4 rounded-md bg-black text-green-400 font-mono text-[11px] overflow-x-auto border border-border/50 mt-2">
                      {JSON.stringify(alert.raw_payload, null, 2)}
                    </pre>
                  </details>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Interactive Node Sidebar */}
        <AlertSidebarContext
          deviceId={alert.device_id}
          deviceName={alert.devices?.name || 'Unknown Device'}
          deviceLocation={alert.devices?.location || null}
          cameraId={alert.camera_id}
          cameraName={alert.cameras?.name || null}
        />
      </div>
    </div>
  )
}
