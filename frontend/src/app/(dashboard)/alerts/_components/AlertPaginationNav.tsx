'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  prevId: string | null
  nextId: string | null
}

export function AlertPaginationNav({ prevId, nextId }: Props) {
  const router = useRouter()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return
      }

      if ((e.key === 'ArrowLeft' || e.key === 'h') && prevId) {
        e.preventDefault()
        router.push(`/alerts/${prevId}`)
      } else if ((e.key === 'ArrowRight' || e.key === 'l') && nextId) {
        e.preventDefault()
        router.push(`/alerts/${nextId}`)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [prevId, nextId, router])

  return (
    <div className="flex items-center gap-1">
      {prevId ? (
        <Link href={`/alerts/${prevId}`}>
          <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
            <ChevronLeft className="size-3.5" /> Prev <kbd className="hidden sm:inline-block text-[9px] font-mono px-1 rounded bg-muted">←</kbd>
          </Button>
        </Link>
      ) : (
        <Button variant="outline" size="sm" disabled className="h-8 gap-1 text-xs opacity-50">
          <ChevronLeft className="size-3.5" /> Prev
        </Button>
      )}

      {nextId ? (
        <Link href={`/alerts/${nextId}`}>
          <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
            Next <kbd className="hidden sm:inline-block text-[9px] font-mono px-1 rounded bg-muted">→</kbd> <ChevronRight className="size-3.5" />
          </Button>
        </Link>
      ) : (
        <Button variant="outline" size="sm" disabled className="h-8 gap-1 text-xs opacity-50">
          Next <ChevronRight className="size-3.5" />
        </Button>
      )}
    </div>
  )
}
