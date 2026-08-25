"use client"

import type { CanvasCard, CanvasEdge } from "@/lib/types"

interface Props {
  cards: CanvasCard[]
  edges: CanvasEdge[]
  onRemove: (edgeId: string) => void
}

function cardCenter(card: CanvasCard) {
  const width = card.fold === 0 ? 72 : 120
  const height = card.fold === 0 ? 24 : 58
  return { x: card.x + width / 2, y: card.y + height / 2 }
}

export function CanvasEdgeLayer({ cards, edges, onRemove }: Props) {
  if (edges.length === 0) return null
  const cardById = new Map(cards.map((card) => [card.id, card]))

  return (
    <svg width="1" height="1" aria-label="画布连线" className="pointer-events-none absolute left-0 top-0 overflow-visible">
      <defs>
        <marker id="story-edge-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L7,3.5 L0,7 z" fill="var(--color-accent)" />
        </marker>
      </defs>
      {edges.map((edge) => {
        const from = cardById.get(edge.fromCardId)
        const to = cardById.get(edge.toCardId)
        if (!from || !to) return null
        const start = cardCenter(from)
        const end = cardCenter(to)
        const midX = (start.x + end.x) / 2
        const midY = (start.y + end.y) / 2
        return (
          <g
            key={edge.id}
            className="pointer-events-auto cursor-pointer"
            onDoubleClick={() => onRemove(edge.id)}
            role="button"
            tabIndex={0}
            aria-label={edge.label ? `移除连线：${edge.label}` : "移除连线"}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === "Delete") onRemove(edge.id)
            }}
          >
            <title>双击移除连线</title>
            <line
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke="var(--color-accent)"
              strokeOpacity="0.65"
              strokeWidth="1.5"
              markerEnd="url(#story-edge-arrow)"
            />
            {edge.label && (
              <text x={midX} y={midY - 6} textAnchor="middle" fill="var(--color-muted)" fontSize="11">
                {edge.label}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
