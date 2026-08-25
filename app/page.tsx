"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { LibrarySidebar } from "@/components/library-sidebar"
import { CanvasCardView } from "@/components/canvas-card"
import { ReaderDrawer } from "@/components/reader-drawer"
import { PluginDrawer } from "@/components/plugin-drawer"
import { TopBar } from "@/components/top-bar"
import { ProjectionBar } from "@/components/projection-bar"
import { PathPanel } from "@/components/path-panel"
import { CanvasEdgeLayer } from "@/components/canvas-edge-layer"
import {
  CANVAS_INDEX_STORAGE_KEY,
  CANVAS_STORAGE_KEY,
  canvasPathStorageKey,
  canvasToMarkdown,
  canvasStorageKey,
  createCanvasSnapshot,
  downloadText,
  findLibraryElement,
  parseCanvasPathState,
  parseCanvasIndex,
  parseCanvasSnapshot,
} from "@/lib/canvas"
import type {
  CanvasCard,
  CanvasCardKind,
  CanvasEdge,
  CanvasIndex,
  CanvasListItem,
  CanvasPathState,
  CanvasRevision,
  ElementDoc,
  PluginDef,
} from "@/lib/types"

let cardSeq = 0

function syncCardSequence(cards: CanvasCard[]) {
  const max = cards.reduce((current, card) => {
    const match = /^card-(\d+)$/.exec(card.id)
    return Math.max(current, match ? Number(match[1]) : 0)
  }, 0)
  cardSeq = Math.max(cardSeq, max)
}

function readPathRevisions(canvasId: string) {
  try {
    const raw = window.localStorage.getItem(canvasPathStorageKey(canvasId))
    return raw ? parseCanvasPathState(JSON.parse(raw)).revisions : []
  } catch {
    return []
  }
}

function writePathRevisions(canvasId: string, revisions: CanvasRevision[]) {
  const state: CanvasPathState = { version: 1, revisions }
  window.localStorage.setItem(canvasPathStorageKey(canvasId), JSON.stringify(state))
}

export default function Page() {
  // ---- 画布视图（平移 / 缩放） ----
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 })
  const [canvasId, setCanvasId] = useState("default")
  const [canvasName, setCanvasName] = useState("未命名画布")
  const [canvasList, setCanvasList] = useState<CanvasListItem[]>([{ id: "default", name: "未命名画布" }])
  // ---- 卡片 ----
  const [cards, setCards] = useState<CanvasCard[]>([])
  const [edges, setEdges] = useState<CanvasEdge[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [connectSourceCardId, setConnectSourceCardId] = useState<string | null>(null)
  const [isDropTarget, setIsDropTarget] = useState(false)
  // ---- UI ----
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [readerElementId, setReaderElementId] = useState<string | null>(null)
  const [readerPluginId, setReaderPluginId] = useState<string | null>(null)
  const [library, setLibrary] = useState<PluginDef[]>([])
  const [libraryLoading, setLibraryLoading] = useState(true)
  const [libraryError, setLibraryError] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [pathOpen, setPathOpen] = useState(false)
  const [revisions, setRevisions] = useState<CanvasRevision[]>([])

  const githubBaseUrl = "https://github.com/shuind/story"

  const containerRef = useRef<HTMLDivElement>(null)
  const drag = useRef<
    | { kind: "pan"; startX: number; startY: number; origX: number; origY: number }
    | { kind: "card"; cardId: string; startX: number; startY: number; origX: number; origY: number; moved: boolean }
    | null
  >(null)

  const refreshLibrary = useCallback(async () => {
    setLibraryLoading(true)
    setLibraryError(null)
    try {
      const response = await fetch("/api/library", { cache: "no-store" })
      if (!response.ok) throw new Error("素材库读取失败")
      setLibrary((await response.json()) as PluginDef[])
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : "素材库读取失败")
    } finally {
      setLibraryLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshLibrary()
  }, [refreshLibrary])

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
        setEdges(snapshot.canvas.edges)
        setView(snapshot.view)
        syncCardSequence(snapshot.canvas.cards)
      }
      setRevisions(readPathRevisions(index.activeId))
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
    const snapshot = createCanvasSnapshot(cards, edges, view, canvasName, canvasId)
    const nextCanvases = canvasList.some((canvas) => canvas.id === canvasId)
      ? canvasList.map((canvas) => (canvas.id === canvasId ? { ...canvas, name: canvasName } : canvas))
      : [...canvasList, { id: canvasId, name: canvasName }]
    const index: CanvasIndex = { activeId: canvasId, canvases: nextCanvases }
    window.localStorage.setItem(canvasStorageKey(canvasId), JSON.stringify(snapshot))
    window.localStorage.setItem(CANVAS_INDEX_STORAGE_KEY, JSON.stringify(index))
  }, [cards, canvasId, canvasList, canvasName, edges, hydrated, view])

  const showNotice = useCallback((message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(null), 2400)
  }, [])

  const createPlugin = useCallback(async () => {
    const name = window.prompt("新维度名称")?.trim()
    if (!name) return
    const description = window.prompt("维度说明（可选）")?.trim() ?? ""
    try {
      const response = await fetch("/api/library/plugin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      })
      const result = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(result.error ?? "维度创建失败")
      await refreshLibrary()
      showNotice(`已创建「${name}」`)
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "维度创建失败")
    }
  }, [refreshLibrary, showNotice])

  const createElement = useCallback(
    async (plugin: PluginDef) => {
      const title = window.prompt(`在「${plugin.name}」中新建元素`)?.trim()
      if (!title) return
      const summary = window.prompt("元素摘要（可选）")?.trim() ?? ""
      const tags = window.prompt("标签（用逗号分隔，可选）")?.trim() ?? ""
      try {
        const response = await fetch("/api/library/element", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pluginId: plugin.id, title, summary, tags }),
        })
        const result = (await response.json()) as { error?: string }
        if (!response.ok) throw new Error(result.error ?? "元素创建失败")
        await refreshLibrary()
        setReaderElementId(`${plugin.id}/${title.replace(/\.md$/i, "")}`)
        showNotice(`已创建「${title}」`)
      } catch (error) {
        showNotice(error instanceof Error ? error.message : "元素创建失败")
      }
    },
    [refreshLibrary, showNotice],
  )

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
        setEdges(snapshot?.canvas.edges ?? [])
        setView(snapshot?.view ?? { x: 0, y: 0, zoom: 1 })
        setRevisions(readPathRevisions(nextId))
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
    setEdges([])
    setView({ x: 0, y: 0, zoom: 1 })
    setRevisions([])
    writePathRevisions(id, [])
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

  const readerPlugin = useMemo(
    () => (readerPluginId ? library.find((plugin) => plugin.id === readerPluginId) ?? null : null),
    [library, readerPluginId],
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
    () => createCanvasSnapshot(cards, edges, view, canvasName, canvasId),
    [cards, canvasId, canvasName, edges, view],
  )

  const saveCheckpoint = useCallback(() => {
    const defaultLabel = `节点 ${revisions.length + 1}`
    const label = window.prompt("节点名称", defaultLabel)?.trim()
    if (!label) return

    const revision: CanvasRevision = {
      id: `revision-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      canvasId,
      parentId: revisions.at(-1)?.id ?? null,
      label,
      createdAt: new Date().toISOString(),
      snapshot: currentSnapshot(),
    }
    const next = [...revisions, revision]
    setRevisions(next)
    writePathRevisions(canvasId, next)
    setPathOpen(true)
    showNotice(`已保存节点「${label}」`)
  }, [canvasId, currentSnapshot, revisions, showNotice])

  const restoreRevision = useCallback(
    (revision: CanvasRevision) => {
      const snapshot = parseCanvasSnapshot(revision.snapshot)
      setCards(snapshot.canvas.cards)
      setEdges(snapshot.canvas.edges)
      setView(snapshot.view)
      setSelected(new Set())
      syncCardSequence(snapshot.canvas.cards)
      showNotice(`已恢复「${revision.label}」`)
    },
    [showNotice],
  )

  const forkRevision = useCallback(
    (revision: CanvasRevision) => {
      const name = window.prompt("分支画布名称", `${canvasName} · ${revision.label}`)?.trim()
      if (!name) return

      const nextId = `canvas-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
      const sourceIndex = revisions.findIndex((item) => item.id === revision.id)
      const sourceRevisions = sourceIndex >= 0 ? revisions.slice(0, sourceIndex + 1) : [revision]
      const revisionIds = new Map(sourceRevisions.map((item) => [item.id, `${nextId}:${item.id}`]))
      const copiedRevisions = sourceRevisions.map((item) => ({
        ...item,
        id: revisionIds.get(item.id) ?? `${nextId}:${item.id}`,
        canvasId: nextId,
        parentId: item.parentId ? revisionIds.get(item.parentId) ?? null : null,
        snapshot: createCanvasSnapshot(
          item.snapshot.canvas.cards,
          item.snapshot.canvas.edges,
          item.snapshot.view,
          name,
          nextId,
        ),
      }))
      const snapshot = parseCanvasSnapshot(revision.snapshot)
      setCanvasList((current) => [...current, { id: nextId, name }])
      setCanvasId(nextId)
      setCanvasName(name)
      setCards(snapshot.canvas.cards)
      setEdges(snapshot.canvas.edges)
      setView(snapshot.view)
      setRevisions(copiedRevisions)
      writePathRevisions(nextId, copiedRevisions)
      setSelected(new Set())
      syncCardSequence(snapshot.canvas.cards)
      setPathOpen(false)
      showNotice(`已从「${revision.label}」创建分支`)
    },
    [canvasName, revisions, showNotice],
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
        setEdges(snapshot.canvas.edges)
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

  // Library 项目 → 点击时放到视野中心，拖拽时放到指针位置
  const placeLibraryItem = useCallback(
    (kind: CanvasCardKind, targetId: string, clientX?: number, clientY?: number) => {
      const rect = containerRef.current?.getBoundingClientRect()
      const cx = clientX !== undefined && rect ? clientX - rect.left : rect ? rect.width / 2 : 500
      const cy = clientY !== undefined && rect ? clientY - rect.top : rect ? rect.height / 2 : 350
      const worldX = (cx - view.x) / view.zoom
      const worldY = (cy - view.y) / view.zoom
      setCards((cs) => [
        ...cs,
        {
          id: `card-${++cardSeq}`,
          kind,
          targetId,
          note: "",
          x: worldX - 60 + (cs.length % 5) * 24,
          y: worldY - 20 + (cs.length % 5) * 24,
          fold: 0,
        },
      ])
    },
    [view],
  )

  const placeElement = useCallback((element: ElementDoc) => placeLibraryItem("element", element.id), [placeLibraryItem])
  const placePlugin = useCallback((plugin: PluginDef) => placeLibraryItem("plugin", plugin.id), [placeLibraryItem])

  const onCanvasDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setIsDropTarget(false)
      const raw = event.dataTransfer.getData("application/x-story-library")
      if (!raw) return
      try {
        const item = JSON.parse(raw) as { kind?: CanvasCardKind; targetId?: string }
        if ((item.kind !== "element" && item.kind !== "plugin") || !item.targetId) return
        placeLibraryItem(item.kind, item.targetId, event.clientX, event.clientY)
      } catch {
        // Ignore unrelated browser drops.
      }
    },
    [placeLibraryItem],
  )

  const onCanvasDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget
    if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
      setIsDropTarget(false)
    }
  }, [])

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
    setEdges((current) => current.filter((edge) => edge.fromCardId !== cardId && edge.toCardId !== cardId))
    setSelected((s) => {
      const next = new Set(s)
      next.delete(cardId)
      return next
    })
    if (connectSourceCardId === cardId) setConnectSourceCardId(null)
  }

  const updateCardNote = useCallback((cardId: string, note: string) => {
    setCards((current) => current.map((card) => (card.id === cardId ? { ...card, note } : card)))
  }, [])

  const removeSelectedCards = useCallback(() => {
    if (selected.size === 0) return
    const ids = new Set(selected)
    setCards((current) => current.filter((card) => !ids.has(card.id)))
    setEdges((current) => current.filter((edge) => !ids.has(edge.fromCardId) && !ids.has(edge.toCardId)))
    setSelected(new Set())
    setConnectSourceCardId(null)
    showNotice(`已删除 ${ids.size} 张卡片`)
  }, [selected, showNotice])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.isContentEditable || target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT") {
        return
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault()
        removeSelectedCards()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [removeSelectedCards])

  const removeEdge = useCallback(
    (edgeId: string) => {
      setEdges((current) => current.filter((edge) => edge.id !== edgeId))
      showNotice("已移除连线")
    },
    [showNotice],
  )

  const selectedCards = cards.filter((card) => selected.has(card.id))
  const selectedCardIds = selectedCards.map((card) => card.id)

  const connectCards = useCallback(
    (fromCardId: string, toCardId: string) => {
      if (fromCardId === toCardId) return
      const label = window.prompt("关系标签（可选）", "关系")
      if (label === null) return
      const exists = edges.some(
        (edge) =>
          (edge.fromCardId === fromCardId && edge.toCardId === toCardId) ||
          (edge.fromCardId === toCardId && edge.toCardId === fromCardId),
      )
      if (exists) {
        showNotice("这两张卡片已经有连线")
        return
      }
      setEdges((current) => [
        ...current,
        {
          id: `edge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          fromCardId,
          toCardId,
          label: label.trim(),
        },
      ])
      showNotice("已建立连线")
    },
    [edges, showNotice],
  )

  const connectSelectedCards = useCallback(() => {
    if (selectedCardIds.length !== 2) return
    const [fromCardId, toCardId] = selectedCardIds
    connectCards(fromCardId, toCardId)
  }, [connectCards, selectedCardIds])

  const startCardConnection = useCallback(
    (cardId: string) => {
      if (!connectSourceCardId) {
        setConnectSourceCardId(cardId)
        showNotice("已选起点，再点击另一张卡片的「连线」")
        return
      }
      if (connectSourceCardId === cardId) {
        setConnectSourceCardId(null)
        return
      }
      connectCards(connectSourceCardId, cardId)
      setConnectSourceCardId(null)
    },
    [connectCards, connectSourceCardId, showNotice],
  )

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
        onTogglePath={() => setPathOpen((open) => !open)}
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
        onPlacePlugin={placePlugin}
        onOpenReader={(el) => {
          setReaderPluginId(null)
          setReaderElementId(el.id)
        }}
        onOpenPlugin={(plugin) => {
          setReaderElementId(null)
          setReaderPluginId(plugin.id)
        }}
        library={library}
        loading={libraryLoading}
        error={libraryError}
        onCreatePlugin={createPlugin}
        onCreateElement={createElement}
      />

      {/* 无限画布 */}
      <div
        ref={containerRef}
        onPointerDown={onBackgroundPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
        onDragEnter={(event) => {
          event.preventDefault()
          setIsDropTarget(true)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={onCanvasDragLeave}
        onDrop={onCanvasDrop}
        className={`canvas-paper h-full w-full cursor-grab touch-none active:cursor-grabbing ${
          isDropTarget ? "ring-2 ring-inset ring-accent/45" : ""
        }`}
        style={{
          backgroundPosition: `${view.x}px ${view.y}px`,
          backgroundSize: `${28 * view.zoom}px ${28 * view.zoom}px`,
        }}
      >
        <div
          className="pointer-events-none absolute left-0 top-0 h-0 w-0"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
        >
          <CanvasEdgeLayer cards={cards} edges={edges} onRemove={removeEdge} />
          <div className="pointer-events-auto">
            {cards.map((card) => (
              (() => {
                if (card.kind === "plugin") {
                  const plugin = library.find((item) => item.id === card.targetId)
                  if (!plugin) return null
                  return (
                    <CanvasCardView
                      key={card.id}
                      card={card}
                      title={plugin.name}
                      eyebrow="维度"
                      excerpt={`${plugin.description || "观察维度"} · ${plugin.elements.length} 个元素`}
                      note={card.note}
                      selected={selected.has(card.id)}
                      onPointerDown={onCardPointerDown}
                      onToggleFold={toggleFold}
                      onUpdateNote={updateCardNote}
                      onOpenReader={() => {
                        setReaderElementId(null)
                        setReaderPluginId(plugin.id)
                      }}
                      readerLabel="读维度"
                      onConnect={() => startCardConnection(card.id)}
                      connectLabel={connectSourceCardId === card.id ? "起点已选" : "连线"}
                      onRemove={removeCard}
                    />
                  )
                }

                const result = findLibraryElement(library, card.targetId)
                if (!result) return null
                return (
                  <CanvasCardView
                    key={card.id}
                    card={card}
                    title={result.element.title}
                    eyebrow={result.element.pluginId}
                    excerpt={result.element.excerpt}
                    note={card.note}
                    selected={selected.has(card.id)}
                    onPointerDown={onCardPointerDown}
                    onToggleFold={toggleFold}
                    onUpdateNote={updateCardNote}
                    onOpenReader={() => {
                      setReaderPluginId(null)
                      setReaderElementId(result.element.id)
                    }}
                    onConnect={() => startCardConnection(card.id)}
                    connectLabel={connectSourceCardId === card.id ? "起点已选" : "连线"}
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
            <p className="font-serif text-sm text-muted/70">从左侧 Library 选一个维度或元素，放上画布</p>
          </div>
        )}
        {isDropTarget && (
          <div className="pointer-events-none fixed inset-x-0 top-24 z-10 flex justify-center">
            <span className="rounded-full border border-accent/30 bg-surface/90 px-4 py-2 text-xs text-accent shadow-sm">
              松开鼠标，把素材放在这里
            </span>
          </div>
        )}
      </div>

      <ProjectionBar
        selectedCards={selectedCards}
        onClear={() => setSelected(new Set())}
        library={library}
        edges={edges}
        onConnect={connectSelectedCards}
        onDelete={removeSelectedCards}
      />

      <PathPanel
        open={pathOpen}
        revisions={revisions}
        onClose={() => setPathOpen(false)}
        onSaveCheckpoint={saveCheckpoint}
        onRestore={restoreRevision}
        onFork={forkRevision}
      />

      <ReaderDrawer
        element={readerElement}
        onClose={() => setReaderElementId(null)}
        onSave={saveElement}
        githubBaseUrl={githubBaseUrl}
      />

      <PluginDrawer
        plugin={readerPlugin}
        onClose={() => setReaderPluginId(null)}
        onOpenElement={(elementId) => {
          setReaderPluginId(null)
          setReaderElementId(elementId)
        }}
      />
    </main>
  )
}
