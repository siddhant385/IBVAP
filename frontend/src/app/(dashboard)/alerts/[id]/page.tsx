import { createClient } from '@/utils/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, Info, MapPin, AlertCircle, AlertTriangle, ShieldCheck, Clock, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BBoxOverlay } from '@/components/alerts/BBoxOverlay'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

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

  // 2. Fetch Detections
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
    .select(`*, watchlist_plates(description, threat_level)`)
    .eq('alert_id', resolvedParams.id)

  // 4. Fetch Evidence URL
  let imageUrl = 'https://images.unsplash.com/photo-1558231221-a3f721524e9f?q=80&w=1200&auto=format&fit=crop'
  if (alert.has_evidence && alert.evidence_path) {
    const { data } = await supabase.storage.from('evidence').createSignedUrl(alert.evidence_path, 3600)
    if (data?.signedUrl) imageUrl = data.signedUrl
  }

  // Helper functions
  const getSeverityBadge = (sev: string) => {
    switch(sev) {
      case 'critical': return <Badge variant="destructive" className="flex gap-1"><AlertCircle className="w-3 h-3" /> Critical</Badge>
      case 'warning': return <Badge variant="default" className="bg-orange-500 flex gap-1"><AlertTriangle className="w-3 h-3" /> Warning</Badge>
      default: return <Badge variant="secondary" className="flex gap-1"><ShieldCheck className="w-3 h-3" /> Info</Badge>
    }
  }

  const getStatusBadge = (stat: string) => {
    switch(stat) {
      case 'unacknowledged': return <Badge variant="outline" className="border-orange-500/50 text-orange-500">Unacknowledged</Badge>
      case 'resolved': return <Badge variant="outline" className="border-green-500/50 text-green-500">Resolved</Badge>
      case 'false_positive': return <Badge variant="outline" className="text-muted-foreground">False Alarm</Badge>
      case 'investigating': return <Badge variant="outline" className="border-blue-500/50 text-blue-500">Investigating</Badge>
      default: return <Badge variant="outline">{stat}</Badge>
    }
  }

  // Calculate Latency
  let latencyMs = 0
  if (alert.received_at && alert.timestamp) {
    latencyMs = new Date(alert.received_at).getTime() - new Date(alert.timestamp).getTime()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/alerts" className="rounded-md p-2 hover:bg-muted text-muted-foreground transition-colors border border-border/50 bg-card">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Alert Investigation</h2>
          <p className="text-muted-foreground">
            {new Date(alert.timestamp).toLocaleString()}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          {getSeverityBadge(alert.severity || 'info')}
          {getStatusBadge(alert.status || 'unacknowledged')}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content Area (Tabs) */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="evidence" className="w-full">
            <TabsList className="w-full grid grid-cols-3 bg-muted/50 p-1 rounded-t-lg rounded-b-none h-12">
              <TabsTrigger value="evidence" className="data-[state=active]:bg-background">Visual Evidence</TabsTrigger>
              <TabsTrigger value="ai-insights" className="data-[state=active]:bg-background">AI Insights</TabsTrigger>
              <TabsTrigger value="lifecycle" className="data-[state=active]:bg-background">Lifecycle & Data</TabsTrigger>
            </TabsList>
            
            <TabsContent value="evidence" className="mt-0">
              <Card className="rounded-t-none border-t-0 overflow-hidden">
                <CardContent className="p-0 bg-black min-h-[500px] flex items-center justify-center">
                  <BBoxOverlay imageUrl={imageUrl} detections={detections || []} />
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="ai-insights" className="mt-0">
              <Card className="rounded-t-none border-t-0 p-6 space-y-8 min-h-[500px]">
                {/* Watchlist Matches */}
                {(faceMatches && faceMatches.length > 0) || (anprMatches && anprMatches.length > 0) ? (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium flex items-center gap-2 text-destructive">
                      <ShieldAlert className="h-5 w-5" /> Watchlist Matches
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {faceMatches?.map(face => (
                        <Card key={face.id} className="border-destructive/30 bg-destructive/5 overflow-hidden">
                          <div className="flex h-24">
                            {/* In real app, createSignedUrl for face_crop_path */}
                            <div className="w-24 bg-black flex items-center justify-center border-r border-destructive/20 text-xs text-muted-foreground">
                              Crop
                            </div>
                            <div className="p-3 flex-1 flex flex-col justify-center">
                              <div className="font-bold">{face.known_faces?.name || 'Unknown'}</div>
                              <div className="text-sm text-muted-foreground flex justify-between mt-1">
                                <span>Similarity:</span>
                                <span className="font-medium text-foreground">{(face.similarity_score! * 100).toFixed(1)}%</span>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                      {anprMatches?.map(plate => (
                        <Card key={plate.id} className="border-orange-500/30 bg-orange-500/5 overflow-hidden">
                          <div className="flex h-24">
                            <div className="w-24 bg-black flex items-center justify-center border-r border-orange-500/20 text-xs text-muted-foreground">
                              Plate Crop
                            </div>
                            <div className="p-3 flex-1 flex flex-col justify-center">
                              <div className="font-bold font-mono text-lg">{plate.plate_text}</div>
                              <div className="text-sm text-muted-foreground flex justify-between mt-1">
                                <span>Confidence:</span>
                                <span className="font-medium text-foreground">{(plate.plate_confidence! * 100).toFixed(1)}%</span>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* General Detections Grouped */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Detected Objects</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {/* Simple grouping by class_name */}
                    {Object.entries(
                      (detections || []).reduce((acc: any, det) => {
                        const name = det.class_name || det.feature
                        acc[name] = (acc[name] || 0) + 1
                        return acc
                      }, {})
                    ).map(([name, count]) => (
                      <Card key={name} className="p-4 flex flex-col items-center justify-center text-center bg-muted/20">
                        <span className="text-3xl font-bold">{count as number}</span>
                        <span className="text-sm text-muted-foreground capitalize">{name}s</span>
                      </Card>
                    ))}
                    {!detections?.length && (
                      <div className="col-span-full text-muted-foreground p-4 bg-muted/10 rounded-md text-center">
                        No specific bounding boxes available.
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </TabsContent>
            
            <TabsContent value="lifecycle" className="mt-0">
              <Card className="rounded-t-none border-t-0 p-6 space-y-6 min-h-[500px]">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="font-medium flex items-center gap-2"><Clock className="h-4 w-4" /> Timeline</h4>
                    <div className="space-y-3 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                      <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-5 h-5 rounded-full border border-primary bg-background text-primary shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2"></div>
                        <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded border border-border/50 bg-card shadow-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Event Generated</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">Edge: {alert.devices?.name}</div>
                          <div className="text-[10px] font-mono text-muted-foreground mt-1">{alert.timestamp}</div>
                        </div>
                      </div>
                      <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-5 h-5 rounded-full border border-primary bg-background text-primary shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2"></div>
                        <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded border border-border/50 bg-card shadow-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Server Received</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">Latency: {(latencyMs / 1000).toFixed(2)}s</div>
                          <div className="text-[10px] font-mono text-muted-foreground mt-1">{alert.received_at}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium flex items-center gap-2"><Info className="h-4 w-4" /> Triage History</h4>
                    <div className="p-4 rounded-md border border-border/50 bg-muted/10 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Status:</span>
                        <span className="font-medium capitalize">{alert.status}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Operator ID:</span>
                        <span className="font-mono text-xs">{alert.operator_id || 'Pending Action'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-border/50">
                  <Accordion>
                    <AccordionItem value="payload" className="border-0">
                      <AccordionTrigger className="hover:no-underline py-2 text-sm font-medium">View Raw JSON Payload</AccordionTrigger>
                      <AccordionContent>
                        <pre className="p-4 rounded-md bg-black text-green-400 font-mono text-[10px] overflow-x-auto">
                          {JSON.stringify(alert.raw_payload, null, 2)}
                        </pre>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar Context */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4" /> Device Context
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <div className="text-muted-foreground mb-1">Source Node</div>
                <div className="font-medium p-2 bg-muted/20 rounded border border-border/50 flex flex-col gap-1">
                  <span>{alert.devices?.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">{alert.device_id}</span>
                </div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1">Camera Stream</div>
                <div className="font-medium p-2 bg-muted/20 rounded border border-border/50 flex flex-col gap-1">
                  <span>{alert.cameras?.name || 'Main Channel'}</span>
                </div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1">Deployment Zone</div>
                <div className="font-medium flex items-center gap-1 p-2 bg-muted/20 rounded border border-border/50">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  {alert.devices?.location}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
