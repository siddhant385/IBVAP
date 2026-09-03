import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  prevId: string | null
  nextId: string | null
}

export function AlertPaginationNav({ prevId, nextId }: Props) {
  return (
    <div className="flex items-center gap-1">
      {prevId ? (
        <Link href={`/alerts/${prevId}`}>
          <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
            <ChevronLeft className="size-3.5" /> Prev Alert
          </Button>
        </Link>
      ) : (
        <Button variant="outline" size="sm" disabled className="h-8 gap-1 text-xs opacity-50">
          <ChevronLeft className="size-3.5" /> Prev Alert
        </Button>
      )}

      {nextId ? (
        <Link href={`/alerts/${nextId}`}>
          <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
            Next Alert <ChevronRight className="size-3.5" />
          </Button>
        </Link>
      ) : (
        <Button variant="outline" size="sm" disabled className="h-8 gap-1 text-xs opacity-50">
          Next Alert <ChevronRight className="size-3.5" />
        </Button>
      )}
    </div>
  )
}
