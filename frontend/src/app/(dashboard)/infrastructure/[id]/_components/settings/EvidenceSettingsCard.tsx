'use client'

import { FileImageIcon } from '@phosphor-icons/react/dist/ssr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'

export interface EvidenceSettings {
  evidence_max_width?: number
  evidence_jpeg_quality?: number
}

interface EvidenceSettingsCardProps {
  settings: EvidenceSettings
  onChange: (patch: Partial<EvidenceSettings>) => void
}

const DEFAULTS: Required<EvidenceSettings> = {
  evidence_max_width: 1280,
  evidence_jpeg_quality: 75,
}

export function EvidenceSettingsCard({ settings, onChange }: EvidenceSettingsCardProps) {
  const q = settings.evidence_jpeg_quality ?? DEFAULTS.evidence_jpeg_quality

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
            <FileImageIcon className="size-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">Evidence Settings</CardTitle>
            <CardDescription>Configure captured evidence quality</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="evidence_width">Max Width (px)</FieldLabel>
            <Input
              id="evidence_width"
              type="number"
              min={320}
              max={1920}
              value={settings.evidence_max_width ?? DEFAULTS.evidence_max_width}
              onChange={(e) => onChange({ evidence_max_width: parseInt(e.target.value) || DEFAULTS.evidence_max_width })}
              className="font-mono"
            />
            <FieldDescription>Maximum width for evidence images</FieldDescription>
          </Field>

          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel>JPEG Quality</FieldLabel>
              <Badge variant="secondary" className="font-mono">{q}%</Badge>
            </div>
            <Slider
              value={[q]}
              min={50}
              max={95}
              step={5}
              onValueChange={(val) => onChange({ evidence_jpeg_quality: Array.isArray(val) ? val[0] : val })}
            />
            <FieldDescription>Higher quality = larger file size</FieldDescription>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
