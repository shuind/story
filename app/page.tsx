"use client"

import type React from "react"
import { useCallback, useRef, useState } from "react"
import { LibrarySidebar } from "@/components/library-sidebar"
import { CanvasCardView } from "@/components/canvas-card"
import { ReaderDrawer } from "@/components/reader-drawer"
import { TopBar } from "@/components/top-bar"
import { ProjectionBar } from "@/components/projection-bar"
import type { CanvasCard, ElementDoc } from "@/lib/types"

let cardSeq = 0

export default function Page() {
  // ---- 画布视图（平移 / 缩放） ----
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 })
  // ---- 卡片 ----
  const [cards, setCards] = useState<CanvasCard[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // ---- UI ----
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [readerElementId, setReaderElementId] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const drag = useRef<
    | { kind: "pan"; startX: number; startY: number; origX: number; origY: number }
    | { kind: "card"; cardId: string; startX: number; startY: number; origX: number; origY: number; moved: boolean }
    | null
  >(null)

  // 侧栏点击元素 → 放到当前视野中心
  const placeElement = useCallback(
    (el: ElementDoc) => {
      const rect = containerRef.current?.getBoundingClientRect()
      const cx = rect ? rect.width / 2 : 500
      const cy = rect ? rect.height / 2 : 350
      const worldX = (cx - view.x) / view.zoom
      const worldY = (cy - view.y) / view.zoom
      setCards((cs) => [
        ...cs,
        {
          id: `card-${++cardSeq}`,
          elementId: el.id,
          x: worldX - 60 + (cs.length % 5) * 24,
          y: worldY - 20 + (cs.length % 5) * 24,
          fold: 0,
        },
      ])
    },
    [view],
  )

  // ---- 指针事件：背景平移 / 卡片拖动 ----
  const onBackgroundPointerDown = (e: React.PointerEvent) => {
    if (e.target !== e.currentTarget) return
    drag.current = { kind: "pan", startX: e.clientX, startY: e.clientY, origX: view.x, origY: view.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onCardPointerDown = (e: React.PointerEvent, cardId: string) => {
    e.stopPropagation()
    const card = cards.find((c) => c.id === cardId)
    if (!card) return
    drag.current = {
      kind: "card",
      cardId,
      startX: e.clientX,
      startY: e.clientY,
      origX: card.x,
      origY: card.y,
      moved: false,
    }
    containerRef.current?.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (d.kind === "pan") {
      setView((v) => ({ ...v, x: d.origX + dx, y: d.origY + dy }))
    } else {
      if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true
      setCards((cs) =>
        cs.map((c) => (c.id === d.cardId ? { ...c, x: d.origX + dx / view.zoom, y: d.origY + dy / view.zoom } : c)),
      )
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (d.kind === "card" && !d.moved) {
      // 视为点击：切换选中（shift 累加）
      setSelected((s) => {
        const next = e.shiftKey ? new Set(s) : new Set<string>()
        if (s.has(d.cardId) && e.shiftKey) next.delete(d.cardId)
        else next.add(d.cardId)
        return next
      })
    }
    if (d.kind === "pan" && Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) < 3) {
      setSelected(new Set())
    }
  }

  // ---- 滚轮缩放（以指针为中心） ----
  const onWheel = (e: React.WheelEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    setView((v) => {
      const nextZoom = Math.min(2.5, Math.max(0.3, v.zoom * (e.deltaY < 0 ? 1.08 : 0.92)))
      const scale = nextZoom / v.zoom
      return { zoom: nextZoom, x: px - (px - v.x) * scale, y: py - (py - v.y) * scale }
    })
  }

  const toggleFold = (cardId: string) =>
    setCards((cs) => cs.map((c) => (c.id === cardId ? { ...c, fold: c.fold === 0 ? 1 : 0 } : c)))

  const removeCard = (cardId: string) => {
    setCards((cs) => cs.filter((c) => c.id !== cardId))
    setSelected((s) => {
      const next = new Set(s)
      next.delete(cardId)
      return next
    })
  }

  const selectedElementIds = cards.filter((c) => selected.has(c.id)).map((c) => c.elementId)

  return (
    <main className="h-screen w-screen overflow-hidden">
      <TopBar canvasName="未命名画布" zoom={view.zoom} onResetView={() => setView({ x: 0, y: 0, zoom: 1 })} />

      <LibrarySidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((o) => !o)}
        onPlace={placeElement}
        onOpenReader={(el) => setReaderElementId(el.id)}
      />

      {/* 无限画布 */}
      <div
        ref={containerRef}
        onPointerDown={onBackgroundPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
        className="canvas-paper h-full w-full cursor-grab touch-none active:cursor-grabbing"
        style={{
          backgroundPosition: `${view.x}px ${view.y}px`,
          backgroundSize: `${28 * view.zoom}px ${28 * view.zoom}px`,
        }}
      >
        <div
          className="pointer-events-none absolute left-0 top-0 h-0 w-0"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
        >
          <div className="pointer-events-auto">
            {cards.map((card) => (
              <CanvasCardView
                key={card.id}
                card={card}
                selected={selected.has(card.id)}
                onPointerDown={onCardPointerDown}
                onToggleFold={toggleFold}
                onOpenReader={(id) => setReaderElementId(id)}
                onRemove={removeCard}
              />
            ))}
          </div>
        </div>

        {/* 空画布引导 */}
        {cards.length === 0 && (
          <div className="pointer-events-none flex h-full items-center justify-center">
            <p className="font-serif text-sm text-muted/70">从左侧 Library 选一个元素，放上画布</p>
          </div>
        )}
      </div>

      <ProjectionBar selectedElementIds={selectedElementIds} onClear={() => setSelected(new Set())} />

      <ReaderDrawer elementId={readerElementId} onClose={() => setReaderElementId(null)} />
    </main>
  )
}
