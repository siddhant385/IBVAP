'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

interface UseRealtimeStatusOptions {
  table: 'cameras' | 'devices'
  filterColumn: 'id' | 'camera_id' | 'device_id'
  filterValue: string | undefined
}

interface UseRealtimeStatusReturn {
  isOnline: boolean | null
}

/**
 * Subscribe to realtime status changes for a camera or device.
 * Returns the current online status with live updates.
 */
export function useRealtimeStatus({
  table,
  filterColumn,
  filterValue
}: UseRealtimeStatusOptions): UseRealtimeStatusReturn {
  const supabase = createClient()
  const [isOnline, setIsOnline] = useState<boolean | null>(null)

  useEffect(() => {
    if (!filterValue) return

    // Fetch initial status
    const fetchInitial = async () => {
      const { data } = await supabase
        .from(table)
        .select('is_online')
        .eq(filterColumn, filterValue)
        .maybeSingle()
      
      if (data) {
        setIsOnline(data.is_online)
      }
    }
    fetchInitial()

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`status_${table}_${filterValue}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table,
          filter: `${filterColumn}=eq.${filterValue}`
        },
        (payload) => {
          const updated = payload.new as { is_online: boolean }
          setIsOnline(updated.is_online)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, table, filterColumn, filterValue])

  return { isOnline }
}
