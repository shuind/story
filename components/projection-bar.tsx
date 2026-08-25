"use client"

import { useState } from "react"
import { getCanvasCardElements } from "@/lib/canvas"
import type { CanvasCard, PluginDef } from "@/lib/types"

interface Props {
  selectedCards: CanvasCard[]
  onClear: () => void
  library: PluginDef[]
  onConnect: () => void
}

/**
 * 投影工具条：选中若干卡片后浮现于画布底部。
 * “复制为 Prompt” 将选中元素的全文拼合为一段 markdown 写入剪贴板，
 * 供粘贴到 ChatGPT / Claude 等 AI 官网进行投影与推衍。
 */
export function ProjectionBar({ selectedCards, onClear, library, onConnect }: Props) {
  const [copied, setCopied] = useState(false)
  if (selectedCards.length === 0) return null

  const copyPrompt = async () => {
    const seen = new Set<string>()
    const parts = selectedCards
      .flatMap((card) => getCanvasCardElements(library, card))
      .filter(({ element }) => {
        if (seen.has(element.id)) return false
        seen.add(element.id)
        return true
      })
      .map(({ element, plugin }) => `## ${element.title}（${plugin.name}）\n\n${element.content.trim()}`)
    const text = [`# 投影素材`, "", ...parts.flatMap((part) => [part, "", "---", ""])]
      .join("\n")
      .replace(/\n---\n\n$/, "\n")
    await navigator.clipboard?.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="pointer-events-none fixed bottom-8 left-0 right-0 z-20 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-4 rounded-full border border-faint bg-surface/95 px-5 py-2.5 shadow-md backdrop-blur-sm">
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
        <button type="button" onClick={onClear} className="text-xs text-muted hover:text-foreground">
          取消
        </button>
      </div>
    </div>
  )
}
