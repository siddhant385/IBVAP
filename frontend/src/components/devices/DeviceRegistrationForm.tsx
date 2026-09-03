'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PlusCircleIcon, CircleNotchIcon, CopyIcon, CheckCircleIcon, XCircleIcon } from '@phosphor-icons/react/dist/ssr'
import { useToastManager } from '@/components/ui/toast'

export function DeviceRegistrationForm() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [deviceId, setDeviceId] = useState('')
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [cameraId, setCameraId] = useState('')
  const [cameraName, setCameraName] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')

  const [credentials, setCredentials] = useState<{ DEVICE_EMAIL: string, DEVICE_PASSWORD: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const toast = useToastManager()

  const reset = () => {
    setDeviceId(''); setName(''); setLocation('')
    setCameraId(''); setCameraName(''); setSourceUrl('')
    setCredentials(null); setError(null); setCopied(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deviceId) return

    setLoading(true)
    setCredentials(null)
    setError(null)

    try {
      const bodyData: Record<string, unknown> = {
        device_id: deviceId,
        name: name || undefined,
        location: location || undefined
      }

      if (cameraId) {
        bodyData.cameras = [
          {
            camera_id: cameraId,
            name: cameraName || undefined,
            source_url: sourceUrl || undefined
          }
        ]
      }

      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.detail || 'Registration failed')
      }

      setCredentials(data.credentials)
      toast.add({ type: 'success', title: 'Device registered', description: `${deviceId} is ready for edge provisioning.` })
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (credentials) {
      navigator.clipboard.writeText(`DEVICE_EMAIL=${credentials.DEVICE_EMAIL}\nDEVICE_PASSWORD=${credentials.DEVICE_PASSWORD}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleClose = () => {
    setOpen(false)
    if (credentials) {
      window.location.reload()
    } else {
      reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val && credentials) return
      if (!val) reset()
      setOpen(val)
    }}>
      <DialogTrigger render={<Button className="gap-2" />}>
        <PlusCircleIcon className="h-4 w-4" weight="bold" /> Register Edge Device
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        {!credentials ? (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Register Edge Device</DialogTitle>
              <DialogDescription>
                Provision a new hardware node for the border network. A unique API key will be generated.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="deviceId" className="text-right">
                  Device ID <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="deviceId"
                  placeholder="e.g. edge-bop-004"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  className="col-span-3 bg-background font-mono text-sm"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  placeholder="North Post Alpha"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="col-span-3 bg-background"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="location" className="text-right">
                  Location
                </Label>
                <Input
                  id="location"
                  placeholder="Sector 7G"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="col-span-3 bg-background"
                />
              </div>

              <div className="pt-2">
                <h4 className="text-sm font-medium border-b border-border pb-2">Initial Camera (Optional)</h4>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="cameraId" className="text-right">
                  Camera ID
                </Label>
                <Input
                  id="cameraId"
                  placeholder="cam-01"
                  value={cameraId}
                  onChange={(e) => setCameraId(e.target.value)}
                  className="col-span-3 bg-background font-mono text-sm"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="cameraName" className="text-right">
                  Camera Name
                </Label>
                <Input
                  id="cameraName"
                  placeholder="Main Gate Cam"
                  value={cameraName}
                  onChange={(e) => setCameraName(e.target.value)}
                  className="col-span-3 bg-background"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="sourceUrl" className="text-right">
                  Stream URL
                </Label>
                <Input
                  id="sourceUrl"
                  placeholder="rtsp://..."
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  className="col-span-3 bg-background"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <XCircleIcon className="mt-0.5 h-4 w-4 shrink-0" weight="fill" />
                  <div>
                    <p className="font-medium">Registration failed</p>
                    <p className="text-destructive/80">{error}</p>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
              <Button type="submit" disabled={loading || !deviceId}>
                {loading ? <CircleNotchIcon className="h-4 w-4 animate-spin mr-2" /> : null}
                Provision Device
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-6 py-4">
            <DialogHeader>
              <DialogTitle className="text-green-500 flex items-center gap-2">
                <CheckCircleIcon className="h-5 w-5" weight="fill" /> Provisioning Successful
              </DialogTitle>
              <DialogDescription className="text-foreground font-medium pt-2">
                Copy these credentials into the device&apos;s `.env` file.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
              <strong>Warning:</strong> For security reasons, the password is not stored in plaintext. If you lose it, you must register a new device or reset credentials via Supabase.
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">DEVICE_EMAIL</Label>
                <Input readOnly value={credentials.DEVICE_EMAIL} className="font-mono bg-muted text-xs" />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">DEVICE_PASSWORD</Label>
                <Input readOnly value={credentials.DEVICE_PASSWORD} className="font-mono bg-muted text-xs" />
              </div>
              <Button variant="secondary" onClick={handleCopy} className="w-full gap-2">
                {copied ? <CheckCircleIcon className="h-4 w-4 text-green-500" weight="fill" /> : <CopyIcon className="h-4 w-4" />}
                {copied ? 'Copied to clipboard' : 'Copy both credentials'}
              </Button>
            </div>

            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                I have copied the credentials
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
