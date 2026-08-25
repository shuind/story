"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { LibrarySidebar } from "@/components/library-sidebar"
import { CanvasCardView } from "@/components/canvas-card"
import { ReaderDrawer } from "@/components/reader-drawer"
import { TopBar } from "@/components/top-bar"
import { ProjectionBar } from "@/components/projection-bar"
import {
  CANVAS_INDEX_STORAGE_KEY,
  CANVAS_STORAGE_KEY,
  canvasToMarkdown,
  canvasStorageKey,
  createCanvasSnapshot,
  downloadText,
  findLibraryElement,
  parseCanvasIndex,
  parseCanvasSnapshot,
} from "@/lib/canvas"
import type { CanvasCard, CanvasIndex, CanvasListItem, ElementDoc, PluginDef } from "@/lib/types"

let cardSeq = 0

function syncCardSequence(cards: CanvasCard[]) {
  const max = cards.reduce((current, card) => {
    const match = /^card-(\d+)$/.exec(card.id)
    return Math.max(current, match ? Number(match[1]) : 0)
  }, 0)
  cardSeq = Math.max(cardSeq, max)
}

export default function Page() {
  // ---- 画布视图（平移 / 缩放） ----
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 })
  const [canvasId, setCanvasId] = useState("default")
  const [canvasName, setCanvasName] = useState("未命名画布")
  const [canvasList, setCanvasList] = useState<CanvasListItem[]>([{ id: "default", name: "未命名画布" }])
  // ---- 卡片 ----
  const [cards, setCards] = useState<CanvasCard[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // ---- UI ----
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [readerElementId, setReaderElementId] = useState<string | null>(null)
  const [library, setLibrary] = useState<PluginDef[]>([])
  const [libraryLoading, setLibraryLoading] = useState(true)
  const [libraryError, setLibraryError] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const githubBaseUrl = "https://github.com/shuind/story"

  const containerRef = useRef<HTMLDivElement>(null)
  const drag = useRef<
    | { kind: "pan"; startX: number; startY: number; origX: number; origY: number }
    | { kind: "card"; cardId: string; startX: number; startY: number; origX: number; origY: number; moved: boolean }
    | null
  >(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/library", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("素材库读取失败")
        return (await response.json()) as PluginDef[]
      })
      .then((data) => {
        if (!cancelled) setLibrary(data)
      })
      .catch((error) => {
        if (!cancelled) setLibraryError(error instanceof Error ? error.message : "素材库读取失败")
      })
      .finally(() => {
        if (!cancelled) setLibraryLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    try {
      const storedIndex = window.localStorage.getItem(CANVAS_INDEX_STORAGE_KEY)
      let index = storedIndex
        ? parseCanvasIndex(JSON.parse(storedIndex))
        : parseCanvasIndex(undefined)

      // Migrate the original single-canvas key into the indexed format.
      if (!storedIndex) {
        const legacyRaw = window.localStorage.getItem(CANVAS_STORAGE_KEY)
        if (legacyRaw) {
          const legacy = parseCanvasSnapshot(JSON.parse(legacyRaw))
          const migrated = {
            ...legacy,
            canvas: { ...legacy.canvas, id: "default" },
          }
          window.localStorage.setItem(CANVAS_STORAGE_KEY, JSON.stringify(migrated))
          index = { activeId: "default", canvases: [{ id: "default", name: legacy.canvas.name }] }
        }
      }

      const activeMeta = index.canvases.find((canvas) => canvas.id === index.activeId) ?? index.canvases[0]
      setCanvasName(activeMeta.name)
      const raw = window.localStorage.getItem(canvasStorageKey(index.activeId))
      if (raw) {
        const snapshot = parseCanvasSnapshot(JSON.parse(raw))
        setCards(snapshot.canvas.cards)
        setView(snapshot.view)
        syncCardSequence(snapshot.canvas.cards)
      }
      setCanvasId(index.activeId)
      setCanvasList(index.canvases)
    } catch {
      window.localStorage.removeItem(CANVAS_INDEX_STORAGE_KEY)
      window.localStorage.removeItem(CANVAS_STORAGE_KEY)
    } finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const snapshot = createCanvasSnapshot(cards, view, canvasName, canvasId)
    const nextCanvases = canvasList.some((canvas) => canvas.id === canvasId)
      ? canvasList.map((canvas) => (canvas.id === canvasId ? { ...canvas, name: canvasName } : canvas))
      : [...canvasList, { id: canvasId, name: canvasName }]
    const index: CanvasIndex = { activeId: canvasId, canvases: nextCanvases }
    window.localStorage.setItem(canvasStorageKey(canvasId), JSON.stringify(snapshot))
    window.localStorage.setItem(CANVAS_INDEX_STORAGE_KEY, JSON.stringify(index))
  }, [cards, canvasId, canvasList, canvasName, hydrated, view])

  const showNotice = useCallback((message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(null), 2400)
  }, [])

  const switchCanvas = useCallback(
    (nextId: string) => {
      if (nextId === canvasId) return
      const metadata = canvasList.find((canvas) => canvas.id === nextId)
      if (!metadata) return

      try {
        const raw = window.localStorage.getItem(canvasStorageKey(nextId))
        const snapshot = raw ? parseCanvasSnapshot(JSON.parse(raw)) : null
        setCanvasId(nextId)
        setCanvasName(metadata.name)
        setCards(snapshot?.canvas.cards ?? [])
        setView(snapshot?.view ?? { x: 0, y: 0, zoom: 1 })
        setSelected(new Set())
        if (snapshot) syncCardSequence(snapshot.canvas.cards)
        showNotice(`已切换到「${metadata.name}」`)
      } catch {
        showNotice("画布读取失败")
      }
    },
    [canvasId, canvasList, showNotice],
  )

  const createCanvas = useCallback(() => {
    const id = `canvas-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    const name = "新画布"
    setCanvasList((current) => [...current, { id, name }])
    setCanvasId(id)
    setCanvasName(name)
    setCards([])
    setView({ x: 0, y: 0, zoom: 1 })
    setSelected(new Set())
    showNotice("已新建画布")
  }, [showNotice])

  const renameCanvas = useCallback(() => {
    const nextName = window.prompt("重命名当前画布", canvasName)?.trim()
    if (!nextName || nextName === canvasName) return
    setCanvasName(nextName)
    setCanvasList((current) => current.map((canvas) => (canvas.id === canvasId ? { ...canvas, name: nextName } : canvas)))
    showNotice("画布名称已更新")
  }, [canvasId, canvasName, showNotice])

  const readerElement = useMemo(
    () => (readerElementId ? findLibraryElement(library, readerElementId)?.element ?? null : null),
    [library, readerElementId],
  )

  const saveElement = useCallback(async (element: ElementDoc, content: string) => {
    const response = await fetch("/api/library/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: element.path, content }),
    })
    const result = (await response.json()) as { error?: string; content?: string }
    if (!response.ok) throw new Error(result.error ?? "素材保存失败")

    setLibrary((current) =>
      current.map((plugin) =>
        plugin.id === element.pluginId
          ? {
              ...plugin,
              elements: plugin.elements.map((item) =>
                item.id === element.id ? { ...item, content: result.content ?? content } : item,
              ),
            }
          : plugin,
      ),
    )
  }, [])

  const currentSnapshot = useCallback(
    () => createCanvasSnapshot(cards, view, canvasName, canvasId),
    [cards, canvasId, canvasName, view],
  )

  const exportJson = useCallback(() => {
    downloadText(`${canvasName}.json`, JSON.stringify(currentSnapshot(), null, 2), "application/json")
    showNotice("已导出 JSON")
  }, [currentSnapshot, showNotice])

  const exportMarkdown = useCallback(() => {
    downloadText(`${canvasName}.md`, canvasToMarkdown(currentSnapshot(), library), "text/markdown;charset=utf-8")
    showNotice("已导出 Markdown")
  }, [currentSnapshot, library, showNotice])

  const importCanvas = useCallback(
    async (file: File) => {
      try {
        const snapshot = parseCanvasSnapshot(JSON.parse(await file.text()))
        setCards(snapshot.canvas.cards)
        setView(snapshot.view)
        setCanvasName(snapshot.canvas.name)
        setCanvasList((current) =>
          current.map((canvas) => (canvas.id === canvasId ? { ...canvas, name: snapshot.canvas.name } : canvas)),
        )
        setSelected(new Set())
        syncCardSequence(snapshot.canvas.cards)
        showNotice("已导入画布")
      } catch (error) {
        showNotice(error instanceof Error ? error.message : "画布导入失败")
      }
    },
    [canvasId, showNotice],
  )

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
      <TopBar
        canvasId={canvasId}
        canvasName={canvasName}
        canvasList={canvasList}
        zoom={view.zoom}
        onResetView={() => setView({ x: 0, y: 0, zoom: 1 })}
        onSwitchCanvas={switchCanvas}
        onCreateCanvas={createCanvas}
        onRenameCanvas={renameCanvas}
        onExportJson={exportJson}
        onExportMarkdown={exportMarkdown}
        onImport={importCanvas}
      />

      {notice && (
        <div className="pointer-events-none fixed left-1/2 top-20 z-30 -translate-x-1/2 rounded border border-faint bg-surface px-4 py-2 text-xs text-foreground shadow-sm">
          {notice}
        </div>
      )}

      <LibrarySidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((o) => !o)}
        onPlace={placeElement}
        onOpenReader={(el) => setReaderElementId(el.id)}
        library={library}
        loading={libraryLoading}
        error={libraryError}
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
              (() => {
                const result = findLibraryElement(library, card.elementId)
                if (!result) return null
                return (
                  <CanvasCardView
                    key={card.id}
                    card={card}
                    element={result.element}
                    selected={selected.has(card.id)}
                    onPointerDown={onCardPointerDown}
                    onToggleFold={toggleFold}
                    onOpenReader={(id) => setReaderElementId(id)}
                    onRemove={removeCard}
                  />
                )
              })()
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

      <ProjectionBar selectedElementIds={selectedElementIds} onClear={() => setSelected(new Set())} library={library} />

      <ReaderDrawer
        element={readerElement}
        onClose={() => setReaderElementId(null)}
        onSave={saveElement}
        githubBaseUrl={githubBaseUrl}
      />
    </main>
  )
}
