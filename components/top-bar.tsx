"use client"

import { useRef } from "react"
import type { CanvasListItem } from "@/lib/types"

interface Props {
  canvasId: string
  canvasName: string
  canvasList: CanvasListItem[]
  zoom: number
  onResetView: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onFitCanvas: () => void
  onSwitchCanvas: (id: string) => void
  onCreateCanvas: () => void
  onRenameCanvas: () => void
  onTogglePath: () => void
  onOpenQuickAdd: () => void
  onExportJson: () => void
  onExportMarkdown: () => void
  onImport: (file: File) => void
}

/**
 * 顶栏：画布切换、缩放指示、导入与导出。
 */
export function TopBar({
  canvasId,
  canvasName,
  canvasList,
  zoom,
  onResetView,
  onZoomIn,
  onZoomOut,
  onFitCanvas,
  onSwitchCanvas,
  onCreateCanvas,
  onRenameCanvas,
  onTogglePath,
  onOpenQuickAdd,
  onExportJson,
  onExportMarkdown,
  onImport,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <header className="pointer-events-none fixed left-0 right-0 top-0 z-20 flex items-center justify-center px-20 py-5">
      <div className="pointer-events-auto flex items-center gap-4 rounded-full border border-faint bg-surface/90 px-5 py-2 shadow-sm backdrop-blur-sm">
        <details className="relative">
          <summary className="flex cursor-pointer list-none items-baseline gap-2 text-sm hover:text-accent">
            <span className="font-serif font-semibold">{canvasName}</span>
            <svg width="8" height="6" viewBox="0 0 8 6" aria-hidden="true" className="text-muted">
              <path d="M1 1.5L4 4.5L7 1.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            </svg>
          </summary>
          <div className="absolute left-0 top-7 z-10 flex min-w-48 flex-col rounded border border-faint bg-surface p-1 shadow-md">
            {canvasList.map((canvas) => (
              <button
                key={canvas.id}
                type="button"
                onClick={() => onSwitchCanvas(canvas.id)}
                className={`rounded px-3 py-1.5 text-left text-xs hover:bg-faint/50 ${canvas.id === canvasId ? "text-accent" : "text-foreground"}`}
              >
                {canvas.name}
              </button>
            ))}
            <span className="my-1 h-px bg-faint" />
            <button type="button" onClick={onCreateCanvas} className="rounded px-3 py-1.5 text-left text-xs text-muted hover:bg-faint/50 hover:text-accent">
              + 新建画布
            </button>
            <button type="button" onClick={onRenameCanvas} className="rounded px-3 py-1.5 text-left text-xs text-muted hover:bg-faint/50 hover:text-accent">
              重命名当前画布
            </button>
          </div>
        </details>

        <span className="h-4 w-px bg-faint" />

        <button
          type="button"
          onClick={onOpenQuickAdd}
          className="flex items-center gap-2 rounded-full bg-foreground px-3 py-1.5 text-xs text-background transition-transform hover:scale-[1.02]"
        >
          <span>添加</span>
          <kbd className="rounded bg-background/15 px-1.5 py-0.5 font-mono text-[10px]">Ctrl/⌘ K</kbd>
        </button>

        <span className="h-4 w-px bg-faint" />

        <div className="flex items-center gap-1 rounded-full border border-faint bg-background/50 p-0.5">
          <button type="button" onClick={onZoomOut} aria-label="缩小画布" title="缩小画布" className="flex h-6 w-6 items-center justify-center rounded-full text-sm text-muted hover:bg-surface hover:text-accent">
            −
          </button>
          <button type="button" onClick={onResetView} title="重置视图" className="min-w-10 px-1 font-mono text-[11px] text-muted hover:text-accent">
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" onClick={onZoomIn} aria-label="放大画布" title="放大画布" className="flex h-6 w-6 items-center justify-center rounded-full text-sm text-muted hover:bg-surface hover:text-accent">
            +
          </button>
        </div>
        <button type="button" onClick={onFitCanvas} className="text-xs text-muted hover:text-accent">
          适配
        </button>

        <span className="h-4 w-px bg-faint" />

        <button type="button" onClick={onTogglePath} className="text-xs text-muted hover:text-accent">
          Path
        </button>

        <span className="h-4 w-px bg-faint" />

        <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs text-muted hover:text-accent">
          导入
        </button>

        <details className="relative">
          <summary className="cursor-pointer list-none text-xs text-muted hover:text-accent">导出</summary>
          <div className="absolute right-0 top-7 flex min-w-28 flex-col rounded border border-faint bg-surface p-1 shadow-md">
            <button type="button" onClick={onExportJson} className="rounded px-3 py-1.5 text-left text-xs hover:bg-faint/50">
              JSON
            </button>
            <button type="button" onClick={onExportMarkdown} className="rounded px-3 py-1.5 text-left text-xs hover:bg-faint/50">
              Markdown
            </button>
          </div>
        </details>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onImport(file)
            event.target.value = ""
          }}
        />
      </div>
    </header>
  )
}
