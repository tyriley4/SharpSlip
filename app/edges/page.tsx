import { EdgesPageClient } from '@/components/edges/EdgesPageClient'
import { getAllEdgesToday } from '@/lib/home/topEdges'

export const revalidate = 3600

export default async function EdgesPage() {
  const edges = await getAllEdgesToday()
  return <EdgesPageClient edges={edges} />
}
