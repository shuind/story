"use client"

import { useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { findElement } from "@/lib/mock-library"

interface Props {
  elementId: string | null
  onClose: () => void
}

/**
 * 全展抽屉：阅读 / 编辑一个元素的完整 markdown。
 * 编辑与保存（commit 到 GitHub）为骨架占位，未接入。
 */
export function ReaderDrawer({ elementId, onClose }: Props) {
  const el = elementId ? findElement(elementId) : undefined
  const [mode, setMode] = useState<"read" | "edit">("read")
  const [draft, setDraft] = useState("")

  useEffect(() => {
    if (el) {
      setDraft(el.content)
      setMode("read")
    }
  }, [el])

  return (
    <>
      {/* 遮罩 */}
      {el && (
        <button
          type="button"
          aria-label="关闭"
          onClick={onClose}
          className="fixed inset-0 z-40 cursor-default bg-foreground/10"
        />
      )}

      <aside
        aria-hidden={!el}
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col border-l border-faint bg-surface shadow-xl transition-transform duration-300 ease-out ${
          el ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {el && (
          <>
            <header className="flex items-center gap-3 border-b border-faint px-6 py-4">
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-serif text-lg font-semibold">{el.title}</h2>
                <p className="truncate font-mono text-[11px] text-muted">{el.path}</p>
              </div>

              <div className="flex items-center gap-1 rounded-full border border-faint p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setMode("read")}
                  className={`rounded-full px-3 py-1 ${mode === "read" ? "bg-accent text-accent-foreground" : "text-muted"}`}
                >
                  阅读
                </button>
                <button
                  type="button"
                  onClick={() => setMode("edit")}
                  className={`rounded-full px-3 py-1 ${mode === "edit" ? "bg-accent text-accent-foreground" : "text-muted"}`}
                >
                  编辑
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="关闭抽屉"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-faint"
              >
                ×
              </button>
            </header>

            {mode === "read" ? (
              <div className="prose-ink flex-1 overflow-y-auto px-8 py-6">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{el.content}</ReactMarkdown>
              </div>
            ) : (
              <div className="flex flex-1 flex-col">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  spellCheck={false}
                  className="flex-1 resize-none bg-transparent px-8 py-6 font-mono text-[13px] leading-6 outline-none"
                />
                <div className="flex items-center justify-between border-t border-faint px-6 py-3">
                  <p className="text-[11px] text-muted">保存将 commit 到 GitHub（骨架阶段未接入）</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(el.content)
                        setMode("read")
                      }}
                      className="rounded border border-faint px-4 py-1.5 text-xs text-muted hover:text-foreground"
                    >
                      放弃
                    </button>
                    <button
                      type="button"
                      title="骨架阶段未接入"
                      className="rounded bg-accent px-4 py-1.5 text-xs text-accent-foreground opacity-60"
                    >
                      保存并提交
                    </button>
                  </div>
                </div>
              </div>
            )}

            <footer className="flex items-center gap-4 border-t border-faint px-6 py-3">
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(el.content)}
                className="text-xs text-accent hover:underline"
              >
                复制全文
              </button>
              <button
                type="button"
                title="骨架阶段未接入：跳转 GitHub 上的此文件"
                className="text-xs text-muted hover:text-accent"
              >
                在 GitHub 打开 ↗
              </button>
            </footer>
          </>
        )}
      </aside>
    </>
  )
}
