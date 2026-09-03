'use client'

import { LightningIcon, VideoIcon, FileImageIcon } from '@phosphor-icons/react/dist/ssr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { cn } from '@/lib/utils'

const ADDITIONAL_PLUGINS: Array<{
  id: 'object_tracking' | 'evidence_capture'
  name: string
  description: string
  icon: React.ReactNode
}> = [
  {
    id: 'object_tracking',
    name: 'Object Tracking',
    description: 'Assign unique IDs to track objects across frames',
    icon: <VideoIcon className="size-4" />
  },
  {
    id: 'evidence_capture',
    name: 'Evidence Capture',
    description: 'Save snapshots when events are detected',
    icon: <FileImageIcon className="size-4" />
  }
]

interface AdditionalPluginsCardProps {
  enabledPlugins: string[]
  onToggle: (pluginId: 'object_tracking' | 'evidence_capture') => void
}

export function AdditionalPluginsCard({ enabledPlugins, onToggle }: AdditionalPluginsCardProps) {
  const isEnabled = (id: string) => enabledPlugins.includes(id)

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
            <LightningIcon className="size-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">Additional Features</CardTitle>
            <CardDescription>Optional enhancements for detection</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          {ADDITIONAL_PLUGINS.map((plugin) => (
            <div
              key={plugin.id}
              className={cn(
                "flex items-center justify-between rounded-xl border p-4 transition-all",
                isEnabled(plugin.id)
                  ? 'bg-primary/5 border-primary/30'
                  : 'bg-muted/30 border-border/50'
              )}
            >
              <Field orientation="horizontal" className="flex-1 gap-3">
                <div className={cn(
                  "flex size-9 items-center justify-center rounded-lg",
                  isEnabled(plugin.id) ? 'bg-primary/10' : 'bg-muted'
                )}>
                  <span className={isEnabled(plugin.id) ? 'text-primary' : 'text-muted-foreground'}>
                    {plugin.icon}
                  </span>
                </div>
                <FieldContent>
                  <FieldLabel htmlFor={plugin.id} className="font-medium cursor-pointer">
                    {plugin.name}
                  </FieldLabel>
                  <FieldDescription className="text-xs">
                    {plugin.description}
                  </FieldDescription>
                </FieldContent>
              </Field>
              <Switch
                id={plugin.id}
                checked={isEnabled(plugin.id)}
                onCheckedChange={() => onToggle(plugin.id)}
              />
            </div>
          ))}
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
