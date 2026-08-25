"use client"

import type React from "react"
import type { CanvasCard as CardType, ElementDoc } from "@/lib/types"

interface Props {
  card: CardType
  element: ElementDoc
  selected: boolean
  onPointerDown: (e: React.PointerEvent, cardId: string) => void
  onToggleFold: (cardId: string) => void
  onOpenReader: (elementId: string) => void
  onRemove: (cardId: string) => void
}

/**
 * 画布卡片，两级折叠：
 * fold 0 —— 墨签：只有一个名字，像贴在画布上的标签
 * fold 1 —— 半展：名字 + 维度 + 一句摘录
 * 全展 —— 不在画布上展开，而是打开右侧抽屉（阅读/编辑）
 */
export function CanvasCardView({ card, element: el, selected, onPointerDown, onToggleFold, onOpenReader, onRemove }: Props) {
  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={(e) => onPointerDown(e, card.id)}
      onDoubleClick={() => onToggleFold(card.id)}
      className={`group absolute select-none rounded border bg-surface shadow-sm transition-shadow ${
        selected ? "border-accent shadow-md" : "border-faint hover:shadow-md"
      }`}
      style={{ left: card.x, top: card.y, width: card.fold === 0 ? "auto" : 240 }}
    >
      {card.fold === 0 ? (
        /* 墨签态 */
        <div className="flex cursor-grab items-center gap-2 px-3 py-1.5 active:cursor-grabbing">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70" />
          <span className="whitespace-nowrap font-serif text-[13px] font-semibold">{el.title}</span>
        </div>
      ) : (
        /* 半展态 */
        <div className="cursor-grab p-3.5 active:cursor-grabbing">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="font-serif text-sm font-semibold">{el.title}</span>
            <span className="shrink-0 text-[10px] tracking-wider text-muted">{el.pluginId}</span>
          </div>
          <p className="text-pretty text-[12px] leading-5 text-muted">{el.excerpt}</p>
          <div className="mt-2.5 flex items-center gap-3 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onOpenReader(el.id)
              }}
              className="text-[11px] text-accent hover:underline"
            >
              全文
            </button>
            <button
              type="button"
              title="骨架阶段未接入：将跳转 GitHub 上的对应文件"
              onClick={(e) => e.stopPropagation()}
              className="text-[11px] text-muted hover:text-accent"
            >
              GitHub
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onRemove(card.id)
              }}
              className="ml-auto text-[11px] text-muted hover:text-accent"
            >
              移除
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
