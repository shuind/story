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

type QuickAddRow =
  | { kind: "plugin"; plugin: PluginDef; index: number }
  | { kind: "element"; plugin: PluginDef; element: ElementDoc; index: number }

interface QuickAddGroup {
  plugin: PluginDef
  elements: ElementDoc[]
}

export function QuickAddPanel({ open, library, onClose, onAddPlugin, onAddElement }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const groups = useMemo<QuickAddGroup[]>(() => {
    const q = query.trim().toLowerCase()

    return library.flatMap((plugin) => {
      const pluginMatches = [plugin.name, plugin.description].some((value) => value.toLowerCase().includes(q))
      const matchingElements = plugin.elements.filter((element) =>
        [element.title, element.excerpt, element.content, element.tags.join(" ")].some((value) =>
          value.toLowerCase().includes(q),
        ),
      )

      if (q && !pluginMatches && matchingElements.length === 0) return []

      return [
        {
          plugin,
          // 搜索命中文件夹时展示全部子项；只命中子项时只展示命中的子项。
          elements: !q || pluginMatches ? plugin.elements : matchingElements,
        },
      ]
    })
  }, [library, query])

  const rows = useMemo<QuickAddRow[]>(() => {
    let index = 0
    return groups.flatMap(({ plugin, elements }) => {
      const rowsForGroup: QuickAddRow[] = [{ kind: "plugin", plugin, index: index++ }]
      if (expanded.has(plugin.id)) {
        rowsForGroup.push(
          ...elements.map((element) => ({ kind: "element" as const, plugin, element, index: index++ })),
        )
      }
      return rowsForGroup
    })
  }, [expanded, groups])

  useEffect(() => {
    if (!open) return
    setQuery("")
    setActiveIndex(0)
    setExpanded(new Set())
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [library, open])

  useEffect(() => {
    if (!query.trim()) return
    setExpanded(new Set(groups.map(({ plugin }) => plugin.id)))
    setActiveIndex(0)
  }, [groups, query])

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(0, rows.length - 1)))
    if (!open) return
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-quick-add-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" })
    })
  }, [activeIndex, open, rows.length])

  if (!open) return null

  const toggleGroup = (pluginId: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(pluginId)) next.delete(pluginId)
      else next.add(pluginId)
      return next
    })
  }

  const addRow = (row: QuickAddRow | undefined) => {
    if (!row) return
    if (row.kind === "plugin") onAddPlugin(row.plugin)
    else onAddElement(row.element)
    onClose()
  }

  const activeRow = rows[activeIndex]

  return (
    <>
      <button type="button" aria-label="关闭快速添加" onClick={onClose} className="fixed inset-0 z-40 cursor-default bg-foreground/20 backdrop-blur-[1px]" />
      <section className="fixed left-1/2 top-[13vh] z-50 w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl border border-faint bg-surface shadow-2xl">
        <div className="flex items-center gap-3 border-b border-faint px-4 py-3">
          <span className="text-muted">＋</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              const nextQuery = event.target.value
              setQuery(nextQuery)
              if (!nextQuery.trim()) setExpanded(new Set())
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") onClose()
              if (event.key === "ArrowDown") {
                event.preventDefault()
                setActiveIndex((index) => Math.min(index + 1, rows.length - 1))
              }
              if (event.key === "ArrowUp") {
                event.preventDefault()
                setActiveIndex((index) => Math.max(index - 1, 0))
              }
              if (event.key === "ArrowRight" && activeRow?.kind === "plugin") {
                event.preventDefault()
                setExpanded((current) => new Set(current).add(activeRow.plugin.id))
              }
              if (event.key === "ArrowLeft" && activeRow?.kind === "plugin") {
                event.preventDefault()
                setExpanded((current) => {
                  const next = new Set(current)
                  next.delete(activeRow.plugin.id)
                  return next
                })
              }
              if (event.key === "ArrowLeft" && activeRow?.kind === "element") {
                event.preventDefault()
                const parentIndex = rows.findIndex(
                  (row) => row.kind === "plugin" && row.plugin.id === activeRow.plugin.id,
                )
                setExpanded((current) => {
                  const next = new Set(current)
                  next.delete(activeRow.plugin.id)
                  return next
                })
                if (parentIndex >= 0) setActiveIndex(parentIndex)
              }
              if (event.key === "Enter") {
                event.preventDefault()
                addRow(activeRow)
              }
            }}
            placeholder="添加一个维度或元素…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/60"
          />
          <kbd className="rounded border border-faint px-1.5 py-0.5 font-mono text-[10px] text-muted">ESC</kbd>
        </div>

        <div className="max-h-[min(58vh,36rem)] overflow-y-auto p-2">
          {rows.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted">没有匹配的维度或元素</p>
          ) : (
            groups.map(({ plugin, elements }) => {
              const pluginRow = rows.find((row) => row.kind === "plugin" && row.plugin.id === plugin.id)
              const isOpen = expanded.has(plugin.id)
              if (!pluginRow) return null

              return (
                <div key={plugin.id} className="mb-1">
                  <div
                    data-quick-add-index={pluginRow.index}
                    className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${activeIndex === pluginRow.index ? "bg-background" : "hover:bg-background/70"}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(plugin.id)}
                      aria-expanded={isOpen}
                      aria-label={`${isOpen ? "收起" : "展开"}${plugin.name}`}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                        <span className="text-xs transition-transform" style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
                          ›
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">{plugin.name}</span>
                          <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted">文件夹</span>
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-muted">
                          {plugin.description || "维度节点"} · {elements.length} 个元素
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => addRow(pluginRow)}
                      aria-label={`把${plugin.name}作为维度添加到画布`}
                      title="添加整个维度"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm text-muted hover:bg-surface hover:text-accent"
                    >
                      ＋
                    </button>
                  </div>

                  {isOpen && (
                    <div className="ml-6 border-l border-faint pl-3">
                      {elements.map((element) => {
                        const elementRow = rows.find((row) => row.kind === "element" && row.element.id === element.id)
                        if (!elementRow || elementRow.kind !== "element") return null
                        return (
                          <button
                            key={element.id}
                            type="button"
                            data-quick-add-index={elementRow.index}
                            onMouseEnter={() => setActiveIndex(elementRow.index)}
                            onClick={() => addRow(elementRow)}
                            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${activeIndex === elementRow.index ? "bg-background" : "hover:bg-background/70"}`}
                          >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-faint/60 text-[11px] text-muted">·</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-medium">{element.title}</span>
                              <span className="mt-0.5 block truncate text-[11px] text-muted">{element.excerpt || "元素节点"}</span>
                            </span>
                            <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted">元素</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

      </section>
    </>
  )
}
