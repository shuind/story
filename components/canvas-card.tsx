"use client"

import type React from "react"
import type { CanvasCard as CardType } from "@/lib/types"

interface Props {
  card: CardType
  title: string
  eyebrow: string
  excerpt: string
  note: string
  selected: boolean
  onPointerDown: (e: React.PointerEvent, cardId: string) => void
  onToggleFold: (cardId: string) => void
  onUpdateNote: (cardId: string, note: string) => void
  onOpenReader?: () => void
  readerLabel?: string
  onConnect?: () => void
  connectLabel?: string
  onRemove: (cardId: string) => void
}

/**
 * 画布卡片，两级折叠。Element 和 Plugin 共用位置、选择、连线与折叠行为：
 * fold 0 —— 墨签：只有一个名字，像贴在画布上的标签
 * fold 1 —— 半展：名字 + 维度 + 一句摘录
 * 半展 —— 显示摘要和可编辑的画布思考；素材全文在右侧抽屉阅读。
 */
export function CanvasCardView({
  card,
  title,
  eyebrow,
  excerpt,
  note,
  selected,
  onPointerDown,
  onToggleFold,
  onUpdateNote,
  onOpenReader,
  readerLabel = "全文",
  onConnect,
  connectLabel = "连线",
  onRemove,
}: Props) {
  return (
    <div
      role="group"
      onPointerDown={(e) => onPointerDown(e, card.id)}
      className={`group absolute select-none rounded-2xl border bg-surface shadow-sm transition-shadow ${
        selected
          ? "border-accent shadow-lg ring-4 ring-accent/10"
          : card.kind === "plugin"
            ? "border-accent/35 hover:border-accent/60 hover:shadow-lg"
            : "border-faint hover:shadow-lg"
      }`}
      style={{ left: card.x, top: card.y, width: card.fold === 0 ? "auto" : 240 }}
    >
      {card.fold === 0 ? (
        /* 墨签态 */
        <div className="flex cursor-grab items-center gap-2 px-3 py-1.5 active:cursor-grabbing">
          <span
            className={
              card.kind === "plugin"
                ? "h-2 w-2 shrink-0 rotate-45 border border-accent/80"
                : "h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70"
            }
          />
          <span className="whitespace-nowrap font-serif text-[13px] font-semibold">{title}</span>
        </div>
      ) : (
        /* 半展态 */
        <div className="cursor-grab p-4 active:cursor-grabbing">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="min-w-0 truncate font-serif text-sm font-semibold">{title}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] tracking-wider ${card.kind === "plugin" ? "bg-accent/10 text-accent" : "bg-faint/60 text-muted"}`}>
              {card.kind === "plugin" ? "PLUGIN" : eyebrow}
            </span>
          </div>
          <p className="text-pretty text-[12px] leading-5 text-muted">{excerpt}</p>
          <div className="mt-3">
            <label className="mb-1 block text-[10px] tracking-wider text-muted">我的思考</label>
            <textarea
              data-card-note={card.id}
              value={note}
              onChange={(event) => onUpdateNote(card.id, event.target.value)}
              onPointerDown={(event) => event.stopPropagation()}
              onDoubleClick={(event) => event.stopPropagation()}
              placeholder="写下判断、问题、冲突或下一步…"
              rows={3}
              className="w-full cursor-text resize-y rounded border border-faint bg-background/50 px-2 py-1.5 text-xs leading-5 text-foreground outline-none placeholder:text-muted/50 focus:border-accent"
            />
          </div>
          <div className="mt-2.5 flex items-center gap-3">
            {onOpenReader && (
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenReader()
                }}
                className="text-[11px] text-accent hover:underline"
              >
                {readerLabel}
              </button>
            )}
            {onConnect && (
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  onConnect()
                }}
                className="text-[11px] text-muted hover:text-accent"
              >
                {connectLabel}
              </button>
            )}
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                onToggleFold(card.id)
              }}
              className="text-[11px] text-muted hover:text-foreground"
            >
              收起
            </button>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
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
