import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

type CameraInput = {
  camera_id: string
  name?: string
  source_url?: string
}

type DeviceRegistrationRequest = {
  device_id?: string
  name?: string
  location?: string
  cameras?: CameraInput[]
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DeviceRegistrationRequest
    const { device_id, name, location, cameras } = body

    if (!device_id) {
      return NextResponse.json({ detail: 'device_id is required' }, { status: 400 })
    }

    // We must use the Service Role key to bypass RLS and create users via the Admin API
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY! // Note: We need this in .env.local now
    )

    // 1. Generate a strong random password for the edge device
    const devicePassword = crypto.randomBytes(24).toString('base64url')
    const deviceEmail = `${device_id}@devices.ibvap.internal`

    // 2. Create the user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: deviceEmail,
      password: devicePassword,
      email_confirm: true,
      user_metadata: { role: 'edge_device' }
    })

    if (authError) {
      if (authError.message.includes('already registered')) {
        return NextResponse.json({ detail: 'Device ID already registered' }, { status: 400 })
      }
      throw authError
    }

    const deviceUuid = authData.user.id

    // 3. Create the device record in the public.devices table
    // Linking the Auth UUID to the Device record is crucial for RLS
    const { error: dbError } = await supabaseAdmin.from('devices').insert({
      id: deviceUuid,
      device_id: device_id,
      name: name || `Edge Device ${device_id}`,
      location: location,
      is_online: false,
      auth_user_id: deviceUuid, // Explicitly link to auth user for RLS checks
    })

    if (dbError) throw dbError

    // 4. Create camera records if provided
    if (cameras && cameras.length > 0) {
      const cameraData = cameras.map((cam) => ({
        device_id: deviceUuid,
        camera_id: cam.camera_id,
        name: cam.name || `Camera ${cam.camera_id}`,
        source_url: cam.source_url,
        is_online: true
      }))
      
      const { error: camError } = await supabaseAdmin.from('cameras').insert(cameraData)
      if (camError) throw camError
    }

    // 5. Return the credentials to the dashboard operator
    return NextResponse.json({
      status: 'success',
      message: 'Device registered securely via Supabase Auth.',
      credentials: {
        DEVICE_EMAIL: deviceEmail,
        DEVICE_PASSWORD: devicePassword
      }
    })

  } catch (error: unknown) {
    console.error('Registration error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { detail: message },
      { status: 500 }
    )
  }
}
