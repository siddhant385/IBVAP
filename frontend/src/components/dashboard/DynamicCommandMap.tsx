'use client'

import dynamic from 'next/dynamic'
import { Card } from '@/components/ui/card'

interface CameraMarker {
  id: string
  name: string | null
  location: string | null
  is_online: boolean
  coordinates: [number, number]
}

const CommandMapClient = dynamic(
  () => import('./CommandMap').then((mod) => mod.CommandMap),
  {
    ssr: false,
    loading: () => (
      <Card className="h-full flex flex-col min-h-[400px] animate-pulse bg-muted/20 justify-center items-center">
        <span className="text-sm text-muted-foreground">Loading GIS Engine...</span>
      </Card>
    )
  }
)

export function DynamicCommandMap({ initialCameras }: { initialCameras: CameraMarker[] }) {
  return <CommandMapClient initialCameras={initialCameras} />
}
