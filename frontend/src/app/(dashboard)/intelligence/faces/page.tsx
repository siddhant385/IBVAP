import { createClient } from '@/utils/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { FaceUploadForm } from '@/components/watchlist/FaceUploadForm'
import { RemoveFaceButton } from '@/components/watchlist/RemoveFaceButton'

export default async function WatchlistFacesPage() {
  const supabase = await createClient()

  const { data: faces, error } = await supabase
    .from('known_faces')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching known faces:', error)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Intelligence: Known Faces</h2>
          <p className="text-muted-foreground">
            Manage biometric profiles for automated recognition across all camera feeds.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/intelligence/vehicles">
            <Button variant="outline">View Vehicles Watchlist</Button>
          </Link>
          <FaceUploadForm />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {faces?.map((face) => (
          <Card key={face.id} className="overflow-hidden border-border/50">
            <div className="aspect-square bg-muted relative">
              {face.reference_image_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img 
                  src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/evidence/${face.reference_image_path}`} 
                  alt={face.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  No Image
                </div>
              )}
              {face.threat_level && face.threat_level !== 'none' && (
                <div className={`absolute top-2 right-2 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1 shadow-lg ${face.threat_level === 'critical' ? 'bg-destructive text-destructive-foreground' : 'bg-amber-500 text-white'}`}>
                  {face.threat_level === 'critical' && <AlertTriangle className="h-3 w-3" />} 
                  {face.threat_level.toUpperCase()}
                </div>
              )}
              {!face.face_embedding && (
                <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  <p className="text-sm font-medium">Processing AI Embedding...</p>
                </div>
              )}
            </div>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base truncate">{face.name}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {face.description || 'No description provided.'}
              </p>
              <div className="flex justify-between items-center mt-4">
                <Badge variant="outline" className="text-xs">ID: {face.id.split('-')[0]}</Badge>
                <RemoveFaceButton faceId={face.id} imagePath={face.reference_image_path} />
              </div>
            </CardContent>
          </Card>
        ))}
        {faces?.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed rounded-lg">
            No biometric profiles active.
          </div>
        )}
      </div>
    </div>
  )
}
