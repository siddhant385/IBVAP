'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/utils/supabase/client'
import { UserCheckIcon, CarIcon } from 'lucide-react'

interface MatchItem {
  id: string
  type: 'face' | 'anpr'
  title: string
  subtitle: string
  /** ISO timestamp string — formatted on the client to avoid hydration mismatch */
  timestamp: string
  confidence?: number
}

export function WatchlistMatchFeed({ initialMatches }: { initialMatches: MatchItem[] }) {
  const [matches, setMatches] = useState<MatchItem[]>(initialMatches)
  const supabase = createClient()

  useEffect(() => {
    const faceChannel = supabase
      .channel('watchlist-face-matches')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'face_results' }, (payload) => {
        const newFace = payload.new
        if (newFace.matched_identity_id) {
          setMatches((prev) => [
            {
              id: newFace.id,
              type: 'face',
              title: 'Identity Match Detected',
              subtitle: `Similarity: ${(newFace.similarity_score * 100).toFixed(1)}%`,
              timestamp: new Date().toISOString(),
              confidence: newFace.similarity_score
            },
            ...prev.slice(0, 4)
          ])
        }
      })
      .subscribe()

    const anprChannel = supabase
      .channel('watchlist-anpr-matches')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'anpr_results' }, (payload) => {
        const newAnpr = payload.new
        if (newAnpr.is_flagged) {
          setMatches((prev) => [
            {
              id: newAnpr.id,
              type: 'anpr',
              title: `Flagged Plate: ${newAnpr.plate_text}`,
              subtitle: `Confidence: ${(newAnpr.plate_confidence * 100).toFixed(1)}%`,
              timestamp: new Date().toISOString(),
              confidence: newAnpr.plate_confidence
            },
            ...prev.slice(0, 4)
          ])
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(faceChannel)
      supabase.removeChannel(anprChannel)
    }
  }, [supabase])

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center justify-between">
          Watchlist & Target Matches
          <Badge variant="secondary">{matches.length} Hits</Badge>
        </CardTitle>
        <CardDescription>Real-time facial identification & ANPR match triggers</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 overflow-y-auto max-h-[300px]">
        {matches.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-xs">
            No active watchlist matches recorded today.
          </div>
        ) : (
          matches.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 bg-card hover:bg-accent/50 transition-colors text-xs">
              <div className={`p-2 rounded-md ${item.type === 'face' ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-500'}`}>
                {item.type === 'face' ? <UserCheckIcon className="h-4 w-4" /> : <CarIcon className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{item.title}</p>
                <p className="text-muted-foreground">{item.subtitle}</p>
              </div>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {new Date(item.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
