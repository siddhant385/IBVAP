import { createClient } from '@/utils/supabase/server'
import { DeviceRegistrationForm } from '@/components/devices/DeviceRegistrationForm'
import { InfrastructureGrid } from '@/components/infrastructure/InfrastructureGrid'
import { Database } from '@/types/database.types'

type Device = Database['public']['Tables']['devices']['Row'] & {
  cameras: Database['public']['Tables']['cameras']['Row'][] | null
}

export default async function InfrastructurePage() {
// ...

  const supabase = await createClient()

  const { data: devices, error } = await supabase
    .from('devices')
    .select(`
      *,
      cameras (
        id,
        device_id,
        name,
        source_url,
        is_online,
        created_at
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching infrastructure:', error)
    return <div className="p-4 text-destructive">Failed to load infrastructure data.</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Border Infrastructure</h2>
          <p className="text-muted-foreground">
            Manage edge AI devices, configure cameras, and set up virtual fences.
          </p>
        </div>
        <div>
          <DeviceRegistrationForm />
        </div>
      </div>

      <InfrastructureGrid initialDevices={devices as Device[]} />
    </div>
  )
}
