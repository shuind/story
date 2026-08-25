"use client"

import { useState } from "react"
import { getCanvasCardElements, getCanvasCardTitle } from "@/lib/canvas"
import type { CanvasCard, CanvasEdge, PluginDef } from "@/lib/types"

interface Props {
  selectedCards: CanvasCard[]
  edges: CanvasEdge[]
  onClear: () => void
  library: PluginDef[]
  onConnect: () => void
  onDelete: () => void
}

/**
 * 投影工具条：选中若干卡片后浮现于画布底部。
 * “复制为 Prompt” 将选中元素的全文拼合为一段 markdown 写入剪贴板，
 * 供粘贴到 ChatGPT / Claude 等 AI 官网进行投影与推衍。
 */
export function ProjectionBar({ selectedCards, edges, onClear, library, onConnect, onDelete }: Props) {
  const [copied, setCopied] = useState(false)
  if (selectedCards.length === 0) return null

  const copyPrompt = async () => {
    const seen = new Set<string>()
    const parts = selectedCards.flatMap((card) => {
      const elements = getCanvasCardElements(library, card).filter(({ element }) => {
        if (seen.has(element.id)) return false
        seen.add(element.id)
        return true
      })
      const note = card.note.trim()
        ? `## 画布思考：${getCanvasCardTitle(library, card)}\n\n${card.note.trim()}`
        : ""
      const content = elements.map(({ element, plugin }) => `## ${element.title}（${plugin.name}）\n\n${element.content.trim()}`)
      return [note, ...content].filter(Boolean)
    })
    const selectedIds = new Set(selectedCards.map((card) => card.id))
    const relations = edges
      .filter((edge) => selectedIds.has(edge.fromCardId) && selectedIds.has(edge.toCardId))
      .map((edge) => {
        const from = selectedCards.find((card) => card.id === edge.fromCardId)
        const to = selectedCards.find((card) => card.id === edge.toCardId)
        if (!from || !to) return ""
        return `- ${getCanvasCardTitle(library, from)} --[${edge.label || "关联"}]→ ${getCanvasCardTitle(library, to)}`
      })
      .filter(Boolean)
    if (relations.length > 0) parts.push(`## 卡片关系\n\n${relations.join("\n")}`)
    const text = [`# 投影素材`, "", ...parts.flatMap((part) => [part, "", "---", ""])]
      .join("\n")
      .replace(/\n---\n\n$/, "\n")
    await navigator.clipboard?.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="pointer-events-none fixed bottom-8 left-0 right-0 z-20 flex justify-center">
      <div className="pointer-events-auto flex max-w-[calc(100vw-2rem)] flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-2xl border border-faint bg-surface/95 px-5 py-2.5 shadow-md backdrop-blur-sm">
        <span className="text-xs text-muted">
          已选 <span className="font-semibold text-foreground">{selectedCards.length}</span> 张卡片
        </span>
        <button
          type="button"
          onClick={copyPrompt}
          className="rounded-full bg-accent px-4 py-1.5 text-xs text-accent-foreground transition-opacity hover:opacity-90"
        >
          {copied ? "已复制 ✓" : "复制为 Prompt"}
        </button>
        {selectedCards.length === 2 && (
          <button type="button" onClick={onConnect} className="text-xs text-muted hover:text-accent">
            连接选中
          </button>
        )}
        <button type="button" onClick={onDelete} className="text-xs text-muted hover:text-accent">
          删除选中
        </button>
        <button type="button" onClick={onClear} className="text-xs text-muted hover:text-foreground">
          取消
        </button>
      </div>
    </div>
  )
}
