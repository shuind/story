"use client"

import type { CanvasRevision } from "@/lib/types"

interface Props {
  open: boolean
  revisions: CanvasRevision[]
  onClose: () => void
  onSaveCheckpoint: () => void
  onRestore: (revision: CanvasRevision) => void
  onFork: (revision: CanvasRevision) => void
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export function PathPanel({ open, revisions, onClose, onSaveCheckpoint, onRestore, onFork }: Props) {
  if (!open) return null

  return (
    <>
      <button type="button" aria-label="关闭 Path" onClick={onClose} className="fixed inset-0 z-30 cursor-default bg-foreground/10" />
      <aside className="fixed bottom-6 right-6 z-40 flex max-h-[calc(100vh-7rem)] w-[min(22rem,calc(100vw-3rem))] flex-col rounded border border-faint bg-surface/95 shadow-xl backdrop-blur-sm">
        <header className="flex items-center gap-3 border-b border-faint px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-base font-semibold">Path</h2>
            <p className="text-[11px] text-muted">保存节点，回到旧方向，或从节点分叉</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭 Path" className="text-lg leading-none text-muted hover:text-foreground">
            ×
          </button>
        </header>

        <div className="flex items-center justify-between border-b border-faint px-5 py-3">
          <span className="text-xs text-muted">{revisions.length} 个节点</span>
          <button type="button" onClick={onSaveCheckpoint} className="rounded bg-accent px-3 py-1.5 text-xs text-accent-foreground hover:opacity-90">
            保存当前节点
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {revisions.length === 0 ? (
            <p className="px-2 py-8 text-center text-xs leading-5 text-muted">还没有节点。保存当前画布后，探索路径会从这里开始。</p>
          ) : (
            <ol className="space-y-2">
              {[...revisions].reverse().map((revision, index) => (
                <li key={revision.id} className="rounded border border-faint bg-background/50 p-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-accent/50 font-mono text-[10px] text-accent">
                      {revisions.length - index}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{revision.label}</p>
                      <p className="mt-0.5 text-[11px] text-muted">{formatDate(revision.createdAt)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3 pl-8 text-[11px]">
                    <button type="button" onClick={() => onRestore(revision)} className="text-accent hover:underline">
                      恢复
                    </button>
                    <button type="button" onClick={() => onFork(revision)} className="text-muted hover:text-accent">
                      从此分叉
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </aside>
    </>
  )
}
