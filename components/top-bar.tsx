"use client"

interface Props {
  canvasName: string
  zoom: number
  onResetView: () => void
}

/**
 * 顶栏：极简一行 —— 画布名、缩放指示、多画布与导出为占位。
 */
export function TopBar({ canvasName, zoom, onResetView }: Props) {
  return (
    <header className="pointer-events-none fixed left-0 right-0 top-0 z-20 flex items-center justify-center px-20 py-5">
      <div className="pointer-events-auto flex items-center gap-4 rounded-full border border-faint bg-surface/90 px-5 py-2 shadow-sm backdrop-blur-sm">
        <button
          type="button"
          title="骨架阶段未接入：多画布切换"
          className="flex items-baseline gap-2 text-sm hover:text-accent"
        >
          <span className="font-serif font-semibold">{canvasName}</span>
          <svg width="8" height="6" viewBox="0 0 8 6" aria-hidden="true" className="text-muted">
            <path d="M1 1.5L4 4.5L7 1.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          </svg>
        </button>

        <span className="h-4 w-px bg-faint" />

        <button
          type="button"
          onClick={onResetView}
          title="回到原点"
          className="font-mono text-[11px] text-muted hover:text-accent"
        >
          {Math.round(zoom * 100)}%
        </button>

        <span className="h-4 w-px bg-faint" />

        <button
          type="button"
          title="骨架阶段未接入：导出画布为 JSON / markdown"
          className="text-xs text-muted hover:text-accent"
        >
          导出
        </button>
      </div>
    </header>
  )
}
