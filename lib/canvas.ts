import type { CanvasCard, CanvasIndex, CanvasListItem, CanvasSnapshot, CanvasView, PluginDef } from "@/lib/types"

export const CANVAS_STORAGE_PREFIX = "story-canvas:"
export const CANVAS_INDEX_STORAGE_KEY = "story-canvas:index"
export const CANVAS_STORAGE_KEY = `${CANVAS_STORAGE_PREFIX}default`

const DEFAULT_VIEW: CanvasView = { x: 0, y: 0, zoom: 1 }

export function canvasStorageKey(id: string) {
  return `${CANVAS_STORAGE_PREFIX}${id}`
}

export function createCanvasSnapshot(
  cards: CanvasCard[],
  view: CanvasView,
  name = "未命名画布",
  id = "default",
): CanvasSnapshot {
  return {
    version: 1,
    canvas: {
      id,
      name,
      cards,
    },
    view,
  }
}

export function parseCanvasIndex(value: unknown): CanvasIndex {
  const fallback: CanvasIndex = {
    activeId: "default",
    canvases: [{ id: "default", name: "未命名画布" }],
  }
  if (!value || typeof value !== "object") return fallback

  const input = value as Partial<CanvasIndex>
  const canvases = Array.isArray(input.canvases)
    ? input.canvases.filter((item): item is CanvasListItem => {
        if (!item || typeof item !== "object") return false
        const candidate = item as Partial<CanvasListItem>
        return typeof candidate.id === "string" && typeof candidate.name === "string" && candidate.id.length > 0
      })
    : []
  if (canvases.length === 0) return fallback

  const activeId = typeof input.activeId === "string" && canvases.some((item) => item.id === input.activeId)
    ? input.activeId
    : canvases[0].id
  return { activeId, canvases }
}

export function parseCanvasSnapshot(value: unknown): CanvasSnapshot {
  if (!value || typeof value !== "object") throw new Error("画布文件格式无效")

  const input = value as Partial<CanvasSnapshot>
  if (input.version !== 1 || !input.canvas || typeof input.canvas !== "object") {
    throw new Error("不支持的画布文件版本")
  }

  const canvas = input.canvas as Partial<CanvasSnapshot["canvas"]>
  const view = input.view as Partial<CanvasView> | undefined
  if (typeof canvas.name !== "string" || !Array.isArray(canvas.cards)) {
    throw new Error("画布文件缺少必要字段")
  }

  const cards = canvas.cards.map((card) => {
    if (!card || typeof card !== "object") throw new Error("画布卡片格式无效")
    const item = card as Partial<CanvasCard>
    if (
      typeof item.id !== "string" ||
      typeof item.elementId !== "string" ||
      typeof item.x !== "number" ||
      typeof item.y !== "number" ||
      (item.fold !== 0 && item.fold !== 1) ||
      !Number.isFinite(item.x) ||
      !Number.isFinite(item.y)
    ) {
      throw new Error("画布卡片字段无效")
    }
    return {
      id: item.id,
      elementId: item.elementId,
      x: item.x,
      y: item.y,
      fold: item.fold,
    }
  })

  const nextView = {
    x: view?.x ?? DEFAULT_VIEW.x,
    y: view?.y ?? DEFAULT_VIEW.y,
    zoom: view?.zoom ?? DEFAULT_VIEW.zoom,
  }
  if (![nextView.x, nextView.y, nextView.zoom].every(Number.isFinite) || nextView.zoom < 0.3 || nextView.zoom > 2.5) {
    throw new Error("画布视图字段无效")
  }

  return {
    version: 1,
    canvas: {
      id: typeof canvas.id === "string" ? canvas.id : "default",
      name: canvas.name,
      cards,
    },
    view: nextView,
  }
}

export function findLibraryElement(library: PluginDef[], elementId: string) {
  for (const plugin of library) {
    const element = plugin.elements.find((item) => item.id === elementId)
    if (element) return { element, plugin }
  }
  return undefined
}

export function canvasToMarkdown(snapshot: CanvasSnapshot, library: PluginDef[]) {
  const sections = snapshot.canvas.cards
    .map((card) => findLibraryElement(library, card.elementId))
    .filter((result): result is NonNullable<typeof result> => Boolean(result))
    .map(({ element, plugin }) => `## ${element.title}（${plugin.name}）\n\n${element.content.trim()}`)

  return [`# ${snapshot.canvas.name}`, "", ...sections.flatMap((section) => [section, "", "---", ""])]
    .join("\n")
    .replace(/\n---\n\n$/, "\n")
}

export function downloadText(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
