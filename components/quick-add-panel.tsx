"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { ElementDoc, PluginDef } from "@/lib/types"

interface Props {
  open: boolean
  library: PluginDef[]
  onClose: () => void
  onAddPlugin: (plugin: PluginDef) => void
  onAddElement: (element: ElementDoc) => void
}

export function QuickAddPanel({ open, library, onClose, onAddPlugin, onAddElement }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const items = library.flatMap((plugin) => [
      { kind: "plugin" as const, plugin, element: null },
      ...plugin.elements.map((element) => ({ kind: "element" as const, plugin, element })),
    ])
    if (!q) return items.slice(0, 12)
    return items
      .filter(({ plugin, element }) =>
        [plugin.name, plugin.description, element?.title ?? "", element?.excerpt ?? ""].some((value) =>
          value.toLowerCase().includes(q),
        ),
      )
      .slice(0, 16)
  }, [library, query])

  useEffect(() => {
    if (!open) return
    setQuery("")
    setActiveIndex(0)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(0, results.length - 1)))
  }, [results.length])

  if (!open) return null

  const addActive = () => {
    const item = results[activeIndex]
    if (!item) return
    if (item.kind === "plugin") onAddPlugin(item.plugin)
    else if (item.element) onAddElement(item.element)
    onClose()
  }

  return (
    <>
      <button type="button" aria-label="关闭快速添加" onClick={onClose} className="fixed inset-0 z-40 cursor-default bg-foreground/20 backdrop-blur-[1px]" />
      <section className="fixed left-1/2 top-[13vh] z-50 w-[min(38rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl border border-faint bg-surface shadow-2xl">
        <div className="flex items-center gap-3 border-b border-faint px-4 py-3">
          <span className="text-muted">＋</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onClose()
              if (event.key === "ArrowDown") {
                event.preventDefault()
                setActiveIndex((index) => Math.min(index + 1, results.length - 1))
              }
              if (event.key === "ArrowUp") {
                event.preventDefault()
                setActiveIndex((index) => Math.max(index - 1, 0))
              }
              if (event.key === "Enter") {
                event.preventDefault()
                addActive()
              }
            }}
            placeholder="添加一个维度或元素…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/60"
          />
          <kbd className="rounded border border-faint px-1.5 py-0.5 font-mono text-[10px] text-muted">ESC</kbd>
        </div>
        <div className="max-h-[min(55vh,32rem)] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted">没有匹配的维度或元素</p>
          ) : (
            results.map((item, index) => (
              <button
                key={`${item.kind}-${item.element?.id ?? item.plugin.id}`}
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  if (item.kind === "plugin") onAddPlugin(item.plugin)
                  else if (item.element) onAddElement(item.element)
                  onClose()
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${
                  activeIndex === index ? "bg-background" : "hover:bg-background/70"
                }`}
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs ${item.kind === "plugin" ? "bg-accent/10 text-accent" : "bg-faint/60 text-muted"}`}>
                  {item.kind === "plugin" ? "◇" : "·"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {item.kind === "plugin" ? item.plugin.name : item.element?.title}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted">
                    {item.kind === "plugin" ? item.plugin.description || "维度节点" : `${item.plugin.name} · ${item.element?.excerpt || "元素节点"}`}
                  </span>
                </span>
                <span className="text-[10px] text-muted">{item.kind === "plugin" ? "PLUGIN" : "ELEMENT"}</span>
              </button>
            ))
          )}
        </div>
        <footer className="flex items-center justify-between border-t border-faint px-4 py-2 text-[10px] text-muted">
          <span>↑ ↓ 选择 · Enter 添加</span>
          <span>也可以从 Library 直接拖入画布</span>
        </footer>
      </section>
    </>
  )
}
