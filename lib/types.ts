// Shared domain types for the library and canvas runtime.

/** 一个元素：library 中的一个 markdown 文件 */
export interface ElementDoc {
  id: string
  /** 所属插件 id */
  pluginId: string
  /** 元素名，即文件名（不含 .md） */
  title: string
  /** 仓库内路径，如 library/宿主母体/维多利亚英国.md */
  path: string
  /** markdown 正文（骨架阶段为内置示例） */
  content: string
  /** 一句话摘录，用于半展态卡片 */
  excerpt: string
  /** 用于 Library 过滤的标签 */
  tags: string[]
}

/** 一个插件：一个观察维度，对应 library 下的一个目录 */
export interface PluginDef {
  id: string
  name: string
  /** 一句话说明该维度 */
  description: string
  elements: ElementDoc[]
}

/** 画布上的一张卡片 */
export type CanvasCardKind = "element" | "plugin"

export interface CanvasCard {
  id: string
  kind: CanvasCardKind
  targetId: string
  x: number
  y: number
  /** 折叠态：0 = 墨签（最折叠），1 = 半展（含摘录） */
  fold: 0 | 1
}

/** 画布上的一条有向关系线 */
export interface CanvasEdge {
  id: string
  fromCardId: string
  toCardId: string
  label: string
}

/** 一张画布 */
export interface CanvasDoc {
  id: string
  name: string
  cards: CanvasCard[]
  edges: CanvasEdge[]
}

export interface CanvasView {
  x: number
  y: number
  zoom: number
}

export interface CanvasSnapshot {
  version: 1
  canvas: CanvasDoc
  view: CanvasView
}

export interface CanvasListItem {
  id: string
  name: string
}

export interface CanvasIndex {
  activeId: string
  canvases: CanvasListItem[]
}

export interface CanvasRevision {
  id: string
  canvasId: string
  parentId: string | null
  label: string
  createdAt: string
  snapshot: CanvasSnapshot
}

export interface CanvasPathState {
  version: 1
  revisions: CanvasRevision[]
}
