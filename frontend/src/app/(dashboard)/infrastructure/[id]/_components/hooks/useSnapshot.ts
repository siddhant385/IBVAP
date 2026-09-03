'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'

// Type for command result from edge device
interface CommandResult {
  image_url?: string
  error?: string
  [key: string]: unknown
}

// Snapshot request timeout in milliseconds
const SNAPSHOT_TIMEOUT_MS = 30000

interface UseSnapshotOptions {
  hardwareDeviceId?: string
  hardwareCameraId?: string
  isOffline?: boolean
  initialImageUrl?: string | null
  onSuccess?: (imageUrl: string) => void
  onError?: (message: string) => void
}

interface UseSnapshotReturn {
  snapshotUrl: string | null
  isRequestingSnapshot: boolean
  snapshotStatus: string
  requestSnapshot: () => Promise<void>
}

/**
 * Hook to manage snapshot requests from edge devices via Supabase realtime.
 * Handles the full lifecycle: insert command → subscribe to updates → cleanup on unmount.
 */
export function useSnapshot({
  hardwareDeviceId,
  hardwareCameraId,
  isOffline = false,
  initialImageUrl = null,
  onSuccess,
  onError
}: UseSnapshotOptions): UseSnapshotReturn {
  const supabase = createClient()
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(initialImageUrl)
  const [isRequestingSnapshot, setIsRequestingSnapshot] = useState(false)
  const [snapshotStatus, setSnapshotStatus] = useState<string>('')
  
  // Cleanup function reference for channel subscription
  const channelCleanupRef = useRef<(() => void) | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelCleanupRef.current) {
        channelCleanupRef.current()
      }
    }
  }, [])

  const requestSnapshot = useCallback(async () => {
    if (!hardwareDeviceId) {
      setSnapshotStatus('Hardware Device ID is missing')
      onError?.('Hardware Device ID is missing')
      return
    }

    if (isOffline) {
      setSnapshotStatus('Device offline')
      return
    }

    setIsRequestingSnapshot(true)
    setSnapshotStatus('Requesting snapshot...')

    try {
      const { data, error: insertError } = await supabase
        .from('device_commands')
        .insert({
          device_id: hardwareDeviceId,
          camera_id: hardwareCameraId || null,
          command: 'snapshot',
          status: 'pending',
          payload: {}
        })
        .select()

      if (insertError) throw insertError
      
      const commandId = data?.[0]?.id
      if (!commandId) throw new Error('No command ID returned')

      const channel = supabase
        .channel(`command_${commandId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'device_commands',
            filter: `id=eq.${commandId}`
          },
          (payload) => {
            const updatedCommand = payload.new as { status: string; result: CommandResult }
            
            if (updatedCommand.status === 'completed') {
              cleanupChannel()
              const resultData = updatedCommand.result
              if (resultData?.image_url) {
                setSnapshotUrl(resultData.image_url)
                setSnapshotStatus('Snapshot ready')
                onSuccess?.(resultData.image_url)
              } else {
                setSnapshotStatus('No image returned')
                onError?.('No image data returned')
              }
              setIsRequestingSnapshot(false)
            } else if (updatedCommand.status === 'failed') {
              cleanupChannel()
              setSnapshotStatus('Snapshot failed')
              setIsRequestingSnapshot(false)
              onError?.('Snapshot failed on edge device')
            }
          }
        )
        .subscribe()

      const cleanupChannel = () => {
        supabase.removeChannel(channel)
        channelCleanupRef.current = null
      }
      
      channelCleanupRef.current = cleanupChannel

      const timeoutId = setTimeout(() => {
        cleanupChannel()
        setIsRequestingSnapshot(false)
        setSnapshotStatus('Timeout - device may be offline')
        onError?.('Edge device did not respond in time')
        supabase
          .from('device_commands')
          .update({ status: 'timeout' })
          .eq('id', commandId)
          .then()
      }, SNAPSHOT_TIMEOUT_MS)

      const originalCleanup = channelCleanupRef.current
      channelCleanupRef.current = () => {
        clearTimeout(timeoutId)
        if (originalCleanup) originalCleanup()
      }

    } catch (error) {
      console.error('Snapshot request error:', error)
      setSnapshotStatus('Failed to request snapshot')
      setIsRequestingSnapshot(false)
      onError?.('Failed to request snapshot')
    }
  }, [supabase, hardwareDeviceId, hardwareCameraId, isOffline, onSuccess, onError])

  return {
    snapshotUrl,
    isRequestingSnapshot,
    snapshotStatus,
    requestSnapshot
  }
}
