"use client"

import { useState } from "react"
import { getCanvasCardElements, getCanvasCardTitle } from "@/lib/canvas"
import type { CanvasCard, CanvasEdge, PluginDef } from "@/lib/types"

interface Props {
  selectedCards: CanvasCard[]
  edges: CanvasEdge[]
  onClear: () => void
  library: PluginDef[]
  onConnect: (label: string) => void
  onDelete: () => void
  onFocusNote: (cardId: string) => void
  onRead: (card: CanvasCard) => void
  onStartConnection: (cardId: string) => void
  connectionMode: boolean
  connectionLabel: string
  onConnectionLabelChange: (label: string) => void
}

/**
 * 投影工具条：选中若干卡片后浮现于画布底部。
 * “复制为 Prompt” 将选中元素的全文拼合为一段 markdown 写入剪贴板，
 * 供粘贴到 ChatGPT / Claude 等 AI 官网进行投影与推衍。
 */
export function ProjectionBar({
  selectedCards,
  edges,
  onClear,
  library,
  onConnect,
  onDelete,
  onFocusNote,
  onRead,
  onStartConnection,
  connectionMode,
  connectionLabel,
  onConnectionLabelChange,
}: Props) {
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
      <div className="pointer-events-auto flex max-w-[min(48rem,calc(100vw-2rem))] flex-wrap items-center justify-center gap-2 rounded-2xl border border-faint bg-surface/95 px-3 py-2.5 shadow-lg backdrop-blur-sm">
        <span className="mr-1 px-2 text-xs text-muted">
          <span className="font-semibold text-foreground">{selectedCards.length}</span> 已选
        </span>
        {selectedCards.length === 1 && (
          <>
            <button type="button" onClick={() => onFocusNote(selectedCards[0].id)} className="rounded-xl px-2.5 py-1.5 text-xs text-muted hover:bg-background hover:text-foreground">
              写笔记
            </button>
            <button type="button" onClick={() => onRead(selectedCards[0])} className="rounded-xl px-2.5 py-1.5 text-xs text-muted hover:bg-background hover:text-accent">
              阅读
            </button>
            {!connectionMode && (
              <button type="button" onClick={() => onStartConnection(selectedCards[0].id)} className="rounded-xl px-2.5 py-1.5 text-xs text-muted hover:bg-background hover:text-accent">
                从这里连线
              </button>
            )}
          </>
        )}
        <button
          type="button"
          onClick={copyPrompt}
          className="rounded-full bg-accent px-4 py-1.5 text-xs text-accent-foreground transition-opacity hover:opacity-90"
        >
          {copied ? "已复制 ✓" : "复制为 Prompt"}
        </button>
        {selectedCards.length === 2 && (
          <div className="flex items-center gap-1 rounded-xl border border-faint bg-background/60 p-1">
            <input
              value={connectionLabel}
              onChange={(event) => onConnectionLabelChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onConnect(connectionLabel)
              }}
              placeholder="关系，例如：催生"
              className="w-32 bg-transparent px-2 py-1 text-xs outline-none placeholder:text-muted/60"
            />
            <button type="button" onClick={() => onConnect(connectionLabel)} className="rounded-lg bg-accent px-2.5 py-1 text-xs text-accent-foreground hover:opacity-90">
              连接
            </button>
          </div>
        )}
        {connectionMode && selectedCards.length === 1 && (
          <div className="flex items-center gap-1 rounded-xl border border-accent/30 bg-accent/5 p-1">
            <span className="px-2 text-[11px] text-accent">选择终点</span>
            <input
              value={connectionLabel}
              onChange={(event) => onConnectionLabelChange(event.target.value)}
              placeholder="关系标签"
              className="w-28 bg-transparent px-2 py-1 text-xs outline-none placeholder:text-muted/60"
            />
          </div>
        )}
        <button type="button" onClick={onDelete} className="rounded-xl px-2.5 py-1.5 text-xs text-muted hover:bg-background hover:text-accent">
          删除选中
        </button>
        <button type="button" onClick={onClear} className="rounded-xl px-2.5 py-1.5 text-xs text-muted hover:bg-background hover:text-foreground">
          取消
        </button>
      </div>
    </div>
  )
}
