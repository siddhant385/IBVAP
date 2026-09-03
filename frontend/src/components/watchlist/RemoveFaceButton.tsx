'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

interface RemoveFaceButtonProps {
  faceId: string
  imagePath: string | null
}

export function RemoveFaceButton({ faceId, imagePath }: RemoveFaceButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleRemove = async () => {
    if (!confirm('Are you sure you want to remove this biometric profile?')) return

    setLoading(true)
    try {
      // 1. Delete image from storage
      if (imagePath) {
        await supabase.storage.from('evidence').remove([imagePath])
      }

      // 2. Delete row from database
      const { error } = await supabase.from('known_faces').delete().eq('id', faceId)
      if (error) throw error

      router.refresh()
    } catch (error: unknown) {
      console.error('Error removing face:', error)
      const message = error instanceof Error ? error.message : 'Unknown error'
      alert(`Failed to remove profile: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      className="text-destructive hover:bg-destructive/10"
      onClick={handleRemove}
      disabled={loading}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Remove'}
    </Button>
  )
}
