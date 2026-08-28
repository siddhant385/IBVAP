import { redirect } from 'next/navigation'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('error', error.message)
    return NextResponse.redirect(url)
  }

  redirect('/')
}
