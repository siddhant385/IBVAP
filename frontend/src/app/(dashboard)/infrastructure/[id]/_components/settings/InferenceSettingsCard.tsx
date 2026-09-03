'use client'

import { GearIcon } from '@phosphor-icons/react/dist/ssr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSet } from '@/components/ui/field'

export interface InferenceSettings {
  confidence_threshold?: number
  nms_threshold?: number
  process_every_n_frames?: number
  inference_size?: number
  target_class_ids?: number[]
}

interface InferenceSettingsCardProps {
  settings: InferenceSettings
  onChange: (patch: Partial<InferenceSettings>) => void
}

const DEFAULTS: Required<InferenceSettings> = {
  confidence_threshold: 0.45,
  nms_threshold: 0.5,
  process_every_n_frames: 5,
  inference_size: 640,
  target_class_ids: [0],
}

export function InferenceSettingsCard({ settings, onChange }: InferenceSettingsCardProps) {
  const c = settings.confidence_threshold ?? DEFAULTS.confidence_threshold
  const n = settings.nms_threshold ?? DEFAULTS.nms_threshold
  const targetClasses = (settings.target_class_ids ?? DEFAULTS.target_class_ids).join(', ')

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
            <GearIcon className="size-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">Inference Settings</CardTitle>
            <CardDescription>Fine-tune model parameters</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <FieldGroup className="flex flex-col gap-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel>Confidence Threshold</FieldLabel>
                <Badge variant="secondary" className="font-mono">{c.toFixed(2)}</Badge>
              </div>
              <Slider
                value={[c]}
                min={0.1}
                max={0.95}
                step={0.01}
                onValueChange={(val) => onChange({ confidence_threshold: Array.isArray(val) ? val[0] : val })}
              />
              <FieldDescription>Minimum confidence score to register a detection</FieldDescription>
            </Field>

            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel>NMS Threshold</FieldLabel>
                <Badge variant="secondary" className="font-mono">{n.toFixed(2)}</Badge>
              </div>
              <Slider
                value={[n]}
                min={0.1}
                max={0.95}
                step={0.01}
                onValueChange={(val) => onChange({ nms_threshold: Array.isArray(val) ? val[0] : val })}
              />
              <FieldDescription>Non-Maximum Suppression to reduce overlapping boxes</FieldDescription>
            </Field>
          </div>

          <FieldSet className="grid gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="process_frames">Process Every N Frames</FieldLabel>
              <Input
                id="process_frames"
                type="number"
                min={1}
                max={30}
                value={settings.process_every_n_frames ?? DEFAULTS.process_every_n_frames}
                onChange={(e) => onChange({ process_every_n_frames: parseInt(e.target.value) || DEFAULTS.process_every_n_frames })}
                className="font-mono"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="inference_size">Inference Size (px)</FieldLabel>
              <Input
                id="inference_size"
                type="number"
                min={320}
                max={1280}
                step={32}
                value={settings.inference_size ?? DEFAULTS.inference_size}
                onChange={(e) => onChange({ inference_size: parseInt(e.target.value) || DEFAULTS.inference_size })}
                className="font-mono"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="target_classes">Target Class IDs</FieldLabel>
              <Input
                id="target_classes"
                value={targetClasses}
                onChange={(e) => onChange({
                  target_class_ids: e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
                })}
                placeholder="0, 1, 2..."
                className="font-mono"
              />
              <FieldDescription>Comma-separated class IDs</FieldDescription>
            </Field>
          </FieldSet>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
