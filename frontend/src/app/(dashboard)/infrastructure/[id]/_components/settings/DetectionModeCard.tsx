'use client'

import { TargetIcon, EyeIcon, PathIcon, ShieldWarningIcon } from '@phosphor-icons/react/dist/ssr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type DetectionMode = 'object_detection' | 'virtual_border' | 'intrusion_detection'

const DETECTION_MODES: Array<{
  id: DetectionMode
  name: string
  description: string
  icon: React.ReactNode
  color: string
  requiresConfig: boolean
}> = [
  {
    id: 'object_detection',
    name: 'Object Detection',
    description: 'Detect and track all objects in frame',
    icon: <EyeIcon className="size-5" />,
    color: 'bg-blue-500/10 border-blue-500/50 text-blue-600',
    requiresConfig: false
  },
  {
    id: 'virtual_border',
    name: 'Virtual Border',
    description: 'Detect objects crossing a line boundary',
    icon: <PathIcon className="size-5" />,
    color: 'bg-amber-500/10 border-amber-500/50 text-amber-600',
    requiresConfig: true
  },
  {
    id: 'intrusion_detection',
    name: 'Intrusion Detection',
    description: 'Detect objects entering a defined zone',
    icon: <ShieldWarningIcon className="size-5" />,
    color: 'bg-red-500/10 border-red-500/50 text-red-600',
    requiresConfig: true
  }
]

interface DetectionModeCardProps {
  value: DetectionMode
  onChange: (mode: DetectionMode) => void
}

export function DetectionModeCard({ value, onChange }: DetectionModeCardProps) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
            <TargetIcon className="size-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">Detection Mode</CardTitle>
            <CardDescription>Select how this camera detects objects</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          {DETECTION_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => onChange(mode.id)}
              aria-pressed={value === mode.id}
              className={cn(
                "relative flex flex-col items-start gap-3 rounded-xl border-2 p-4 text-left transition-all",
                value === mode.id
                  ? `${mode.color} border-current shadow-sm`
                  : 'bg-muted/30 border-border/50 hover:bg-muted/50 hover:border-border'
              )}
            >
              <div className={cn(
                "flex size-10 items-center justify-center rounded-lg",
                value === mode.id ? 'bg-current/10' : 'bg-muted'
              )}>
                <span className={value === mode.id ? 'text-current' : 'text-muted-foreground'}>
                  {mode.icon}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{mode.name}</span>
                  {mode.requiresConfig && value === mode.id && (
                    <Badge variant="outline" className="text-xs">Needs Config</Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{mode.description}</p>
              </div>
              {value === mode.id && (
                <div className="absolute right-2 top-2 size-2 rounded-full bg-current" />
              )}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
