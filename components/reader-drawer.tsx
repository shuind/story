"use client"

import { useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { ElementDoc } from "@/lib/types"

interface Props {
  element: ElementDoc | null
  onClose: () => void
  onSave: (element: ElementDoc, content: string) => Promise<void>
  githubBaseUrl: string
}

/**
 * 全展抽屉：阅读 / 编辑一个元素的完整 markdown。
 */
export function ReaderDrawer({ element: el, onClose, onSave, githubBaseUrl }: Props) {
  const [mode, setMode] = useState<"read" | "edit">("read")
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (el) {
      setDraft(el.content)
      setMode("read")
      setSaveError(null)
    }
  }, [el])

  const saveDraft = async () => {
    if (!el) return
    setSaving(true)
    setSaveError(null)
    try {
      await onSave(el, draft)
      setMode("read")
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "素材保存失败")
    } finally {
      setSaving(false)
    }
  }

  const githubHref = el
    ? `${githubBaseUrl}/blob/v0/project-69d95889/${el.path
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/")}`
    : "#"

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
                  <p className="text-[11px] text-muted">保存将写回本地 library/ 文件</p>
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
                      onClick={saveDraft}
                      disabled={saving}
                      className="rounded bg-accent px-4 py-1.5 text-xs text-accent-foreground disabled:cursor-wait disabled:opacity-60"
                    >
                      {saving ? "保存中…" : "保存"}
                    </button>
                  </div>
                </div>
                {saveError && <p className="px-6 pb-3 text-xs text-accent">{saveError}</p>}
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
              <a href={githubHref} target="_blank" rel="noreferrer" className="text-xs text-muted hover:text-accent">
                在 GitHub 打开 ↗
              </a>
            </footer>
          </>
        )}
      </aside>
    </>
  )
}
