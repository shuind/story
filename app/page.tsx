"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { LibrarySidebar } from "@/components/library-sidebar"
import { CanvasCardView } from "@/components/canvas-card"
import { ReaderDrawer } from "@/components/reader-drawer"
import { PluginDrawer } from "@/components/plugin-drawer"
import { QuickAddPanel } from "@/components/quick-add-panel"
import { InputDialog, type InputDialogField } from "@/components/input-dialog"
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
  CanvasView,
  ElementDoc,
  PluginDef,
} from "@/lib/types"

let cardSeq = 0

interface SelectionRect {
  left: number
  top: number
  width: number
  height: number
}

function selectionRectFromPoints(startX: number, startY: number, endX: number, endY: number): SelectionRect {
  return {
    left: Math.min(startX, endX),
    top: Math.min(startY, endY),
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY),
  }
}

function cardScreenBounds(card: CanvasCard, view: { x: number; y: number; zoom: number }) {
  const width = card.fold === 0 ? 170 : 240
  const height = card.fold === 0 ? 36 : 230
  return {
    left: view.x + card.x * view.zoom,
    top: view.y + card.y * view.zoom,
    right: view.x + (card.x + width) * view.zoom,
    bottom: view.y + (card.y + height) * view.zoom,
  }
}

interface DialogConfig {
  title: string
  description?: string
  fields: InputDialogField[]
  submitLabel: string
  onSubmit: (values: Record<string, string>) => Promise<void> | void
}

interface HistoryState {
  cards: CanvasCard[]
  edges: CanvasEdge[]
  view: CanvasView
}

function cloneHistoryState(state: HistoryState): HistoryState {
  return {
    cards: state.cards.map((card) => ({ ...card })),
    edges: state.edges.map((edge) => ({ ...edge })),
    view: { ...state.view },
  }
}

function historyStateKey(state: HistoryState) {
  return JSON.stringify(state)
}

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
  const [connectionLabel, setConnectionLabel] = useState("")
  const [isDropTarget, setIsDropTarget] = useState(false)
  const [selectionBox, setSelectionBox] = useState<SelectionRect | null>(null)
  // ---- UI ----
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [readerElementId, setReaderElementId] = useState<string | null>(null)
  const [readerPluginId, setReaderPluginId] = useState<string | null>(null)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [dialog, setDialog] = useState<DialogConfig | null>(null)
  const [library, setLibrary] = useState<PluginDef[]>([])
  const [libraryLoading, setLibraryLoading] = useState(true)
  const [libraryError, setLibraryError] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [pathOpen, setPathOpen] = useState(false)
  const [revisions, setRevisions] = useState<CanvasRevision[]>([])
  const [historyVersion, setHistoryVersion] = useState(0)

  const githubBaseUrl = "https://github.com/shuind/story"

  const containerRef = useRef<HTMLDivElement>(null)
  const spacePressed = useRef(false)
  const cardClipboard = useRef<{ cards: CanvasCard[]; edges: CanvasEdge[] } | null>(null)
  const history = useRef<{ entries: HistoryState[]; index: number; timer: number | null }>({
    entries: [],
    index: -1,
    timer: null,
  })
  const historyInitialized = useRef(false)
  const historySuppressNextEffect = useRef(false)
  const drag = useRef<
    | { kind: "pan"; startX: number; startY: number; origX: number; origY: number }
    | {
        kind: "card"
        cardId: string
        cardIds: string[]
        startX: number
        startY: number
        origPositions: Record<string, { x: number; y: number }>
        moved: boolean
      }
    | { kind: "select"; startX: number; startY: number; moved: boolean }
    | null
  >(null)

  const showNotice = useCallback((message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(null), 2400)
  }, [])

  const resetHistory = useCallback((state: HistoryState) => {
    const snapshot = cloneHistoryState(state)
    if (history.current.timer !== null) window.clearTimeout(history.current.timer)
    history.current = { entries: [snapshot], index: 0, timer: null }
    historyInitialized.current = true
    historySuppressNextEffect.current = false
    setHistoryVersion((version) => version + 1)
  }, [])

  const recordHistoryState = useCallback((state: HistoryState) => {
    if (!historyInitialized.current) return
    const snapshot = cloneHistoryState(state)
    const current = history.current.entries[history.current.index]
    if (current && historyStateKey(current) === historyStateKey(snapshot)) return
    const entries = history.current.entries.slice(0, history.current.index + 1)
    entries.push(snapshot)
    if (entries.length > 100) entries.shift()
    history.current.entries = entries
    history.current.index = entries.length - 1
    setHistoryVersion((version) => version + 1)
  }, [])

  const flushHistory = useCallback(
    (state: HistoryState) => {
      if (history.current.timer !== null) {
        window.clearTimeout(history.current.timer)
        history.current.timer = null
      }
      recordHistoryState(state)
    },
    [recordHistoryState],
  )

  const restoreHistoryState = useCallback((state: HistoryState) => {
    historySuppressNextEffect.current = true
    setCards(state.cards.map((card) => ({ ...card })))
    setEdges(state.edges.map((edge) => ({ ...edge })))
    setView({ ...state.view })
    setSelected(new Set())
    setConnectSourceCardId(null)
    setConnectionLabel("")
    setSelectionBox(null)
  }, [])

  const undo = useCallback(() => {
    if (!hydrated || !historyInitialized.current) return
    flushHistory({ cards, edges, view })
    const previousIndex = history.current.index - 1
    if (previousIndex < 0) return
    history.current.index = previousIndex
    restoreHistoryState(history.current.entries[previousIndex])
    showNotice("已撤销")
  }, [cards, edges, flushHistory, hydrated, restoreHistoryState, showNotice, view])

  const redo = useCallback(() => {
    if (!hydrated || !historyInitialized.current) return
    flushHistory({ cards, edges, view })
    const nextIndex = history.current.index + 1
    if (nextIndex >= history.current.entries.length) return
    history.current.index = nextIndex
    restoreHistoryState(history.current.entries[nextIndex])
    showNotice("已重做")
  }, [cards, edges, flushHistory, hydrated, restoreHistoryState, showNotice, view])

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
    let initialState: HistoryState = { cards: [], edges: [], view: { x: 0, y: 0, zoom: 1 } }
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
        initialState = { cards: snapshot.canvas.cards, edges: snapshot.canvas.edges, view: snapshot.view }
        syncCardSequence(snapshot.canvas.cards)
      }
      setRevisions(readPathRevisions(index.activeId))
      setCanvasId(index.activeId)
      setCanvasList(index.canvases)
      resetHistory(initialState)
    } catch {
      window.localStorage.removeItem(CANVAS_INDEX_STORAGE_KEY)
      window.localStorage.removeItem(CANVAS_STORAGE_KEY)
      resetHistory(initialState)
    } finally {
      setHydrated(true)
    }
  }, [resetHistory])

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

  useEffect(() => {
    if (!hydrated || !historyInitialized.current) return
    if (historySuppressNextEffect.current) {
      historySuppressNextEffect.current = false
      return
    }
    if (history.current.timer !== null) window.clearTimeout(history.current.timer)
    history.current.timer = window.setTimeout(() => {
      history.current.timer = null
      recordHistoryState({ cards, edges, view })
    }, 220)
  }, [cards, edges, hydrated, recordHistoryState, view])

  useEffect(() => {
    return () => {
      if (history.current.timer !== null) window.clearTimeout(history.current.timer)
    }
  }, [])

  const createPlugin = useCallback(() => {
    setDialog({
      title: "新建维度",
      description: "维度是画布上的一种观察方式，例如：时代情绪、宿主母体、行当。",
      fields: [
        { key: "name", label: "维度名称", placeholder: "例如：城市经验", required: true },
        { key: "description", label: "一句说明", placeholder: "这个维度观察什么？", multiline: true },
      ],
      submitLabel: "创建维度",
      onSubmit: async (values) => {
        const name = values.name.trim()
        const description = values.description?.trim() ?? ""
        const response = await fetch("/api/library/plugin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description }),
        })
        const result = (await response.json()) as { error?: string }
        if (!response.ok) throw new Error(result.error ?? "维度创建失败")
        await refreshLibrary()
        showNotice(`已创建「${name}」`)
      },
    })
  }, [refreshLibrary, showNotice])

  const createElement = useCallback(
    (plugin: PluginDef) => {
      setDialog({
        title: `在「${plugin.name}」中新建元素`,
        description: "先建立一个素材节点，再在右侧抽屉中补充完整 Markdown。",
        fields: [
          { key: "title", label: "元素名称", placeholder: "例如：夜间经济", required: true },
          { key: "summary", label: "摘要", placeholder: "一句话说明它的感觉或作用", multiline: true },
          { key: "tags", label: "标签", placeholder: "用逗号分隔，例如：城市,阶级" },
        ],
        submitLabel: "创建元素",
        onSubmit: async (values) => {
          const title = values.title.trim()
          const summary = values.summary?.trim() ?? ""
          const tags = values.tags?.trim() ?? ""
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
        },
      })
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
        const nextState: HistoryState = {
          cards: snapshot?.canvas.cards ?? [],
          edges: snapshot?.canvas.edges ?? [],
          view: snapshot?.view ?? { x: 0, y: 0, zoom: 1 },
        }
        setCanvasId(nextId)
        setCanvasName(metadata.name)
        setCards(nextState.cards)
        setEdges(nextState.edges)
        setView(nextState.view)
        resetHistory(nextState)
        setRevisions(readPathRevisions(nextId))
        setSelected(new Set())
        setConnectSourceCardId(null)
        setConnectionLabel("")
        if (snapshot) syncCardSequence(snapshot.canvas.cards)
        showNotice(`已切换到「${metadata.name}」`)
      } catch {
        showNotice("画布读取失败")
      }
    },
    [canvasId, canvasList, resetHistory, showNotice],
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
    resetHistory({ cards: [], edges: [], view: { x: 0, y: 0, zoom: 1 } })
    setRevisions([])
    writePathRevisions(id, [])
    setSelected(new Set())
    setConnectSourceCardId(null)
    setConnectionLabel("")
    showNotice("已新建画布")
  }, [resetHistory, showNotice])

  const renameCanvas = useCallback(() => {
    setDialog({
      title: "重命名画布",
      fields: [{ key: "name", label: "画布名称", placeholder: "例如：伦敦夜行", required: true }],
      submitLabel: "保存名称",
      onSubmit: (values) => {
        const nextName = values.name.trim()
        if (nextName === canvasName) return
        setCanvasName(nextName)
        setCanvasList((current) => current.map((canvas) => (canvas.id === canvasId ? { ...canvas, name: nextName } : canvas)))
        showNotice("画布名称已更新")
      },
    })
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
    setDialog({
      title: "保存 Path 节点",
      description: "给这一刻的探索命名，之后可以从这里恢复或分叉。",
      fields: [{ key: "label", label: "节点名称", placeholder: defaultLabel, required: true }],
      submitLabel: "保存节点",
      onSubmit: (values) => {
        const label = values.label.trim()
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
      },
    })
  }, [canvasId, currentSnapshot, revisions, showNotice])

  const restoreRevision = useCallback(
    (revision: CanvasRevision) => {
      const snapshot = parseCanvasSnapshot(revision.snapshot)
      setCards(snapshot.canvas.cards)
      setEdges(snapshot.canvas.edges)
      setView(snapshot.view)
      resetHistory({ cards: snapshot.canvas.cards, edges: snapshot.canvas.edges, view: snapshot.view })
      setSelected(new Set())
      setConnectSourceCardId(null)
      setConnectionLabel("")
      syncCardSequence(snapshot.canvas.cards)
      showNotice(`已恢复「${revision.label}」`)
    },
    [resetHistory, showNotice],
  )

  const forkRevision = useCallback(
    (revision: CanvasRevision) => {
      setDialog({
        title: "从节点分叉",
        description: `从「${revision.label}」创建一张新的画布，原路径会保留。`,
        fields: [{ key: "name", label: "新画布名称", placeholder: `${canvasName} · ${revision.label}`, required: true }],
        submitLabel: "创建分支",
        onSubmit: (values) => {
          const name = values.name.trim()
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
          resetHistory({ cards: snapshot.canvas.cards, edges: snapshot.canvas.edges, view: snapshot.view })
          setRevisions(copiedRevisions)
          writePathRevisions(nextId, copiedRevisions)
          setSelected(new Set())
          setConnectSourceCardId(null)
          setConnectionLabel("")
          syncCardSequence(snapshot.canvas.cards)
          setPathOpen(false)
          showNotice(`已从「${revision.label}」创建分支`)
        },
      })
    },
    [canvasName, resetHistory, revisions, showNotice],
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
        resetHistory({ cards: snapshot.canvas.cards, edges: snapshot.canvas.edges, view: snapshot.view })
        setCanvasName(snapshot.canvas.name)
        setCanvasList((current) =>
          current.map((canvas) => (canvas.id === canvasId ? { ...canvas, name: snapshot.canvas.name } : canvas)),
        )
        setSelected(new Set())
        setConnectSourceCardId(null)
        setConnectionLabel("")
        syncCardSequence(snapshot.canvas.cards)
        showNotice("已导入画布")
      } catch (error) {
        showNotice(error instanceof Error ? error.message : "画布导入失败")
      }
    },
    [canvasId, resetHistory, showNotice],
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
    if (e.button === 1 || spacePressed.current) {
      e.preventDefault()
      drag.current = { kind: "pan", startX: e.clientX, startY: e.clientY, origX: view.x, origY: view.y }
    } else {
      setConnectSourceCardId(null)
      setConnectionLabel("")
      drag.current = { kind: "select", startX: e.clientX, startY: e.clientY, moved: false }
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) setSelectionBox(selectionRectFromPoints(e.clientX - rect.left, e.clientY - rect.top, e.clientX - rect.left, e.clientY - rect.top))
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onCardPointerDown = (e: React.PointerEvent, cardId: string) => {
    e.stopPropagation()
    const card = cards.find((c) => c.id === cardId)
    if (!card) return
    if (e.button === 1 || spacePressed.current) {
      e.preventDefault()
      drag.current = { kind: "pan", startX: e.clientX, startY: e.clientY, origX: view.x, origY: view.y }
      containerRef.current?.setPointerCapture(e.pointerId)
      return
    }
    const cardIds = selected.has(cardId) && selected.size > 1 ? Array.from(selected) : [cardId]
    const origPositions = Object.fromEntries(
      cards
        .filter((item) => cardIds.includes(item.id))
        .map((item) => [item.id, { x: item.x, y: item.y }]),
    )
    drag.current = {
      kind: "card",
      cardId,
      cardIds,
      startX: e.clientX,
      startY: e.clientY,
      origPositions,
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
    } else if (d.kind === "select") {
      if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) setSelectionBox(selectionRectFromPoints(d.startX - rect.left, d.startY - rect.top, e.clientX - rect.left, e.clientY - rect.top))
    } else {
      if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true
      setCards((cs) =>
        cs.map((card) => {
          const origin = d.origPositions[card.id]
          return origin && d.cardIds.includes(card.id)
            ? { ...card, x: origin.x + dx / view.zoom, y: origin.y + dy / view.zoom }
            : card
        }),
      )
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (d.kind === "select") {
      const rect = containerRef.current?.getBoundingClientRect()
      const box = rect
        ? selectionRectFromPoints(d.startX - rect.left, d.startY - rect.top, e.clientX - rect.left, e.clientY - rect.top)
        : selectionBox
      setSelectionBox(null)
      if (!d.moved || !rect || !box) {
        setSelected(new Set())
        setConnectSourceCardId(null)
        setConnectionLabel("")
        return
      }
      const next = new Set(
        cards
          .filter((card) => {
            const bounds = cardScreenBounds(card, { x: view.x, y: view.y, zoom: view.zoom })
            return bounds.left < box.left + box.width && bounds.right > box.left && bounds.top < box.top + box.height && bounds.bottom > box.top
          })
          .map((card) => card.id),
      )
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        setSelected((current) => new Set([...current, ...next]))
      } else {
        setSelected(next)
      }
      return
    }
    if (d.kind === "card" && !d.moved) {
      if (connectSourceCardId) {
        if (connectSourceCardId === d.cardId) {
          setConnectSourceCardId(null)
          setConnectionLabel("")
          return
        }
        connectCards(connectSourceCardId, d.cardId, connectionLabel)
        setConnectSourceCardId(null)
        setConnectionLabel("")
        setSelected(new Set([connectSourceCardId, d.cardId]))
        return
      }
      // 视为点击：切换选中（shift 累加）
      setSelected((s) => {
        const additive = e.shiftKey || e.metaKey || e.ctrlKey
        const next = additive ? new Set(s) : new Set<string>()
        if (s.has(d.cardId) && additive) next.delete(d.cardId)
        else next.add(d.cardId)
        return next
      })
    }
    if (d.kind === "pan" && Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) < 3) {
      setSelected(new Set())
      setConnectSourceCardId(null)
      setConnectionLabel("")
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

  const adjustZoom = useCallback((factor: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const px = rect.width / 2
    const py = rect.height / 2
    setView((current) => {
      const nextZoom = Math.min(2.5, Math.max(0.3, current.zoom * factor))
      const scale = nextZoom / current.zoom
      return { zoom: nextZoom, x: px - (px - current.x) * scale, y: py - (py - current.y) * scale }
    })
  }, [])

  const fitCanvas = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || cards.length === 0) {
      setView({ x: 0, y: 0, zoom: 1 })
      return
    }
    const padding = 96
    const minX = Math.min(...cards.map((card) => card.x))
    const minY = Math.min(...cards.map((card) => card.y))
    const maxX = Math.max(...cards.map((card) => card.x + (card.fold === 0 ? 170 : 240)))
    const maxY = Math.max(...cards.map((card) => card.y + (card.fold === 0 ? 36 : 230)))
    const contentWidth = Math.max(1, maxX - minX)
    const contentHeight = Math.max(1, maxY - minY)
    const zoom = Math.min(2.5, Math.max(0.3, Math.min((rect.width - padding * 2) / contentWidth, (rect.height - padding * 2) / contentHeight)))
    setView({
      zoom,
      x: rect.width / 2 - ((minX + maxX) / 2) * zoom,
      y: rect.height / 2 - ((minY + maxY) / 2) * zoom,
    })
  }, [cards])

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
    if (connectSourceCardId === cardId) {
      setConnectSourceCardId(null)
      setConnectionLabel("")
    }
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
    setConnectionLabel("")
    showNotice(`已删除 ${ids.size} 张卡片`)
  }, [selected, showNotice])

  const nudgeSelectedCards = useCallback((dx: number, dy: number) => {
    if (selected.size === 0) return
    setCards((current) =>
      current.map((card) => (selected.has(card.id) ? { ...card, x: card.x + dx, y: card.y + dy } : card)),
    )
  }, [selected])

  const cloneCards = useCallback(
    (sourceCards: CanvasCard[], sourceEdges: CanvasEdge[]) => {
      if (sourceCards.length === 0) return
      const idMap = new Map(sourceCards.map((card) => [card.id, `card-${++cardSeq}`]))
      const clones = sourceCards.map((card) => ({
        ...card,
        id: idMap.get(card.id) ?? `card-${++cardSeq}`,
        x: card.x + 32,
        y: card.y + 32,
      }))
      const clonedEdges = sourceEdges.map((edge) => ({
        ...edge,
        id: `edge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        fromCardId: idMap.get(edge.fromCardId) ?? edge.fromCardId,
        toCardId: idMap.get(edge.toCardId) ?? edge.toCardId,
      }))
      setCards((current) => [...current, ...clones])
      setEdges((current) => [...current, ...clonedEdges])
      setSelected(new Set(clones.map((card) => card.id)))
      showNotice(`已复制 ${clones.length} 张卡片`)
    },
    [showNotice],
  )

  const duplicateSelectedCards = useCallback(() => {
    const sourceCards = cards.filter((card) => selected.has(card.id))
    cloneCards(sourceCards, edges.filter((edge) => selected.has(edge.fromCardId) && selected.has(edge.toCardId)))
  }, [cards, cloneCards, edges, selected])

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTyping = target?.isContentEditable || target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT"
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k" && !isTyping) {
        event.preventDefault()
        setQuickAddOpen(true)
      }
      if (event.key === "Escape") {
        setQuickAddOpen(false)
        setDialog(null)
        setConnectSourceCardId(null)
        setConnectionLabel("")
        setSelectionBox(null)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTyping = target?.isContentEditable || target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT"
      if (isTyping) return

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") {
        event.preventDefault()
        redo()
        return
      }

      if (event.code === "Space") {
        event.preventDefault()
        spacePressed.current = true
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
        event.preventDefault()
        setSelected(new Set(cards.map((card) => card.id)))
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d" && selected.size > 0) {
        event.preventDefault()
        duplicateSelectedCards()
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c" && selected.size > 0) {
        event.preventDefault()
        const copiedCards = cards.filter((card) => selected.has(card.id))
        cardClipboard.current = {
          cards: copiedCards,
          edges: edges.filter((edge) => selected.has(edge.fromCardId) && selected.has(edge.toCardId)),
        }
        showNotice(`已复制 ${copiedCards.length} 张卡片`)
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "v" && cardClipboard.current) {
        event.preventDefault()
        cloneCards(cardClipboard.current.cards, cardClipboard.current.edges)
        return
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault()
        adjustZoom(1.15)
        return
      }
      if (event.key === "-") {
        event.preventDefault()
        adjustZoom(0.87)
        return
      }
      if (event.key === "0") {
        event.preventDefault()
        fitCanvas()
        return
      }
      if (selected.size > 0) {
        const step = event.shiftKey ? 10 : 2
        if (event.key === "ArrowUp") {
          event.preventDefault()
          nudgeSelectedCards(0, -step)
        } else if (event.key === "ArrowDown") {
          event.preventDefault()
          nudgeSelectedCards(0, step)
        } else if (event.key === "ArrowLeft") {
          event.preventDefault()
          nudgeSelectedCards(-step, 0)
        } else if (event.key === "ArrowRight") {
          event.preventDefault()
          nudgeSelectedCards(step, 0)
        }
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") spacePressed.current = false
    }
    const onBlur = () => {
      spacePressed.current = false
    }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    window.addEventListener("blur", onBlur)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("blur", onBlur)
    }
  }, [adjustZoom, cards, cloneCards, duplicateSelectedCards, edges, fitCanvas, nudgeSelectedCards, redo, selected.size, showNotice, undo])

  const removeEdge = useCallback(
    (edgeId: string) => {
      setEdges((current) => current.filter((edge) => edge.id !== edgeId))
      showNotice("已移除连线")
    },
    [showNotice],
  )

  const selectedCards = cards.filter((card) => selected.has(card.id))
  const selectedCardIds = selectedCards.map((card) => card.id)
  const canUndo = historyVersion >= 0 && historyInitialized.current && history.current.index > 0
  const canRedo = historyVersion >= 0 && historyInitialized.current && history.current.index < history.current.entries.length - 1

  const connectCards = useCallback(
    (fromCardId: string, toCardId: string, label: string) => {
      if (fromCardId === toCardId) return
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
          label: label.trim() || "关联",
        },
      ])
      showNotice("已建立连线")
    },
    [edges, showNotice],
  )

  const connectSelectedCards = useCallback((label: string) => {
    if (selectedCardIds.length !== 2) return
    const [fromCardId, toCardId] = selectedCardIds
    connectCards(fromCardId, toCardId, label)
    setConnectionLabel("")
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
        setConnectionLabel("")
        return
      }
      connectCards(connectSourceCardId, cardId, connectionLabel)
      setConnectSourceCardId(null)
      setConnectionLabel("")
    },
    [connectCards, connectSourceCardId, connectionLabel, showNotice],
  )

  const toggleCardNote = useCallback(
    (cardId: string) => {
      const card = cards.find((item) => item.id === cardId)
      if (!card) return
      const opening = card.fold === 0
      setCards((current) => current.map((item) => (item.id === cardId ? { ...item, fold: opening ? 1 : 0 } : item)))
      if (opening) {
        requestAnimationFrame(() => {
          document.querySelector<HTMLTextAreaElement>(`[data-card-note="${cardId}"]`)?.focus()
        })
      }
    },
    [cards],
  )

  const clearSelection = useCallback(() => {
    setSelected(new Set())
    setConnectSourceCardId(null)
    setConnectionLabel("")
  }, [])

  const cancelConnection = useCallback(() => {
    setConnectSourceCardId(null)
    setConnectionLabel("")
  }, [])

  const readCard = useCallback(
    (card: CanvasCard) => {
      if (card.kind === "plugin") {
        setReaderElementId(null)
        setReaderPluginId(card.targetId)
      } else {
        setReaderPluginId(null)
        setReaderElementId(card.targetId)
      }
    },
    [],
  )

  return (
    <main className="h-screen w-screen overflow-hidden">
      <TopBar
        canvasId={canvasId}
        canvasName={canvasName}
        canvasList={canvasList}
        zoom={view.zoom}
        onResetView={() => setView({ x: 0, y: 0, zoom: 1 })}
        onZoomIn={() => adjustZoom(1.15)}
        onZoomOut={() => adjustZoom(0.87)}
        onFitCanvas={fitCanvas}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onSwitchCanvas={switchCanvas}
        onCreateCanvas={createCanvas}
        onRenameCanvas={renameCanvas}
        onTogglePath={() => setPathOpen((open) => !open)}
        onOpenQuickAdd={() => setQuickAddOpen(true)}
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
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onDragEnter={(event) => {
          event.preventDefault()
          setIsDropTarget(true)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={onCanvasDragLeave}
        onDrop={onCanvasDrop}
        className={`canvas-paper relative h-full w-full cursor-grab touch-none active:cursor-grabbing ${
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
        {selectionBox && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-10 rounded border border-accent/70 bg-accent/10"
            style={{
              left: selectionBox.left,
              top: selectionBox.top,
              width: selectionBox.width,
              height: selectionBox.height,
            }}
          />
        )}

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
        {cards.length > 0 && selectedCards.length === 0 && !quickAddOpen && (
          <div className="pointer-events-none fixed bottom-5 left-5 z-10 rounded-full border border-faint/80 bg-surface/80 px-3 py-2 text-[10px] text-muted backdrop-blur-sm">
            拖入素材 · 空白拖拽框选 · Shift/Ctrl 多选 · Space 平移
          </div>
        )}
      </div>

      <ProjectionBar
        selectedCards={selectedCards}
        onClear={clearSelection}
        library={library}
        edges={edges}
        onConnect={connectSelectedCards}
        onDelete={removeSelectedCards}
        onToggleNote={toggleCardNote}
        onRead={readCard}
        onStartConnection={startCardConnection}
        onCancelConnection={cancelConnection}
        connectionMode={connectSourceCardId !== null}
        connectionLabel={connectionLabel}
        onConnectionLabelChange={setConnectionLabel}
      />

      <QuickAddPanel
        open={quickAddOpen}
        library={library}
        onClose={() => setQuickAddOpen(false)}
        onAddPlugin={(plugin) => placePlugin(plugin)}
        onAddElement={(element) => placeElement(element)}
      />

      <InputDialog
        open={dialog !== null}
        title={dialog?.title ?? ""}
        description={dialog?.description}
        fields={dialog?.fields ?? []}
        submitLabel={dialog?.submitLabel ?? "确认"}
        onClose={() => setDialog(null)}
        onSubmit={dialog?.onSubmit ?? (() => undefined)}
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
