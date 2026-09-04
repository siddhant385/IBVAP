'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { useGodsEyeInit, useGodsEyeStream, useGodsEyeClock } from './store'
import { GodsEyeHeader } from './GodsEyeHeader'
import { GodsEyeMap } from './GodsEyeMap'
import { GodsEyeSidebar } from './GodsEyeSidebar'
import { GodsEyeEvidencePanel } from './GodsEyeEvidencePanel'
import { GodsEyeLegend } from './GodsEyeLegend'
import type { CameraNode, DetectionPing, FlaggedEntity, Zone } from './lib'

interface Props {
  cameras: CameraNode[]
  detections: DetectionPing[]
  flagged: FlaggedEntity[]
  zones: Zone[]
}

export function GodsEyeClient(props: Props) {
  useGodsEyeInit(props)
  useGodsEyeStream()
  useGodsEyeClock()

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 h-[calc(100vh-180px)]">
      <Card className="flex flex-col overflow-hidden">
        <CardHeader className="pb-3 space-y-2">
          <GodsEyeHeader />
        </CardHeader>
        <CardContent className="flex-1 p-0 relative">
          <GodsEyeMap
            initialCameras={props.cameras}
            initialZones={props.zones}
          />
          <GodsEyeLegend />
          <GodsEyeEvidencePanel />
        </CardContent>
      </Card>
      <GodsEyeSidebar />
    </div>
  )
}
