'use client'

import dynamic from 'next/dynamic'
import { Card } from '@/components/ui/card'
import type { CameraNode, DetectionPing, FlaggedEntity, Zone } from './godseye/lib'

const GodsEyeClient = dynamic(
  () => import('./godseye/GodsEyeClient').then((m) => m.GodsEyeClient),
  {
    ssr: false,
    loading: () => (
      <Card className="h-[calc(100vh-180px)] flex items-center justify-center text-muted-foreground text-sm animate-pulse">
        Initializing God&apos;s Eye...
      </Card>
    ),
  }
)

export function GodsEyeLoader(props: {
  cameras: CameraNode[]
  detections: DetectionPing[]
  flagged: FlaggedEntity[]
  zones: Zone[]
}) {
  return <GodsEyeClient {...props} />
}
