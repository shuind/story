// 领域类型 —— UI 骨架阶段仅用于组件间传递，未接入真实数据源

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
export interface CanvasCard {
  id: string
  elementId: string
  x: number
  y: number
  /** 折叠态：0 = 墨签（最折叠），1 = 半展（含摘录） */
  fold: 0 | 1
}

/** 一张画布 */
export interface CanvasDoc {
  id: string
  name: string
  cards: CanvasCard[]
}
