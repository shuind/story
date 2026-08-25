"use client"

import { useMemo, useState } from "react"
import type { ElementDoc, PluginDef } from "@/lib/types"

interface Props {
  open: boolean
  onToggle: () => void
  onPlace: (el: ElementDoc) => void
  onOpenReader: (el: ElementDoc) => void
  library: PluginDef[]
  loading: boolean
  error: string | null
  onCreatePlugin: () => void
  onCreateElement: (plugin: PluginDef) => void
}

/**
 * Library 侧栏：搜索 / 按插件浏览 / 放上画布。
 * 默认完全收起，只留一枚墨点开关 —— 呼吸感的第一层。
 */
export function LibrarySidebar({
  open,
  onToggle,
  onPlace,
  onOpenReader,
  library,
  loading,
  error,
  onCreatePlugin,
  onCreateElement,
}: Props) {
  const [query, setQuery] = useState("")
  const [tagFilter, setTagFilter] = useState("")
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const tags = useMemo(
    () =>
      Array.from(new Set(library.flatMap((plugin) => plugin.elements.flatMap((element) => element.tags)))).sort((a, b) =>
        a.localeCompare(b, "zh-CN"),
      ),
    [library],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return library
      .map((plugin) => ({
        ...plugin,
        elements: plugin.elements.filter((element) => {
          const matchesQuery =
            !q ||
            [element.title, element.excerpt, element.content, element.tags.join(" ")].some((value) =>
              value.toLowerCase().includes(q),
            )
          const matchesTag = !tagFilter || element.tags.includes(tagFilter)
          return matchesQuery && matchesTag
        }),
      }))
      .filter((plugin) => plugin.elements.length > 0 || plugin.name.toLowerCase().includes(q))
  }, [library, query, tagFilter])

  return (
    <>
      {/* 开关：一枚墨点 */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? "收起 Library" : "打开 Library"}
        className="fixed left-5 top-5 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-faint bg-surface text-foreground shadow-sm transition-transform hover:scale-105"
      >
        <span
          className={`block h-2 w-2 rounded-full bg-accent transition-transform duration-300 ${open ? "scale-150" : ""}`}
        />
      </button>

      {/* 面板 */}
      <aside
        aria-hidden={!open}
        className={`fixed left-0 top-0 z-30 flex h-full w-72 flex-col border-r border-faint bg-surface/95 backdrop-blur-sm transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 pb-3 pt-16">
          <p className="font-serif text-xs tracking-[0.3em] text-muted">LIBRARY</p>
        </div>

        <div className="px-5 pb-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索插件或元素…"
            className="w-full border-b border-faint bg-transparent pb-1.5 text-sm outline-none placeholder:text-muted/60 focus:border-accent"
          />
          <select
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
            aria-label="按标签筛选"
            className="mt-3 w-full border-b border-faint bg-transparent pb-1.5 text-xs text-muted outline-none focus:border-accent"
          >
            <option value="">全部标签</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                #{tag}
              </option>
            ))}
          </select>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-6">
          {loading && <p className="px-2 py-4 text-xs text-muted">正在读取素材库…</p>}
          {!loading && error && <p className="px-2 py-4 text-xs text-accent">{error}</p>}
          {!loading && !error && filtered.length === 0 && (
            <p className="px-2 py-4 text-xs text-muted">没有匹配的元素</p>
          )}

          {!loading && !error && filtered.map((plugin) => {
            const isOpen = expanded[plugin.id] ?? query.trim().length > 0
            return (
              <div key={plugin.id} className="mb-1">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setExpanded((s) => ({ ...s, [plugin.id]: !isOpen }))}
                    className="flex min-w-0 flex-1 items-baseline gap-2 rounded px-2 py-2 text-left hover:bg-faint/50"
                  >
                    <span
                      className={`shrink-0 whitespace-nowrap font-serif text-sm font-semibold ${isOpen ? "text-accent" : ""}`}
                    >
                      {plugin.name}
                    </span>
                    <span className="truncate text-[11px] text-muted">{plugin.description}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onCreateElement(plugin)}
                    aria-label={`在${plugin.name}中新建元素`}
                    title="新建元素"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-base text-muted hover:bg-faint/50 hover:text-accent"
                  >
                    +
                  </button>
                </div>

                {isOpen && (
                  <ul className="mb-2 ml-2 border-l border-faint pl-3">
                    {plugin.elements.map((el) => (
                      <li key={el.id} className="group flex items-center gap-1 py-1">
                        <button
                          type="button"
                          onClick={() => onPlace(el)}
                          title="放上画布"
                          className="flex-1 truncate text-left text-[13px] leading-6 text-foreground/85 hover:text-accent"
                        >
                          {el.title}
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenReader(el)}
                          title="阅读全文"
                          className="rounded px-1.5 text-[11px] text-muted opacity-0 transition-opacity hover:text-accent group-hover:opacity-100"
                        >
                          读
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}

          <button
            type="button"
            onClick={onCreatePlugin}
            className="mt-4 w-full rounded border border-dashed border-faint px-2 py-2 text-center text-xs text-muted hover:border-accent/40 hover:text-accent"
          >
            + 新维度
          </button>
        </nav>

        <div className="border-t border-faint px-5 py-3">
          <p className="text-[11px] leading-5 text-muted">
            点击元素放上画布 · 悬停「读」直达全文
          </p>
        </div>
      </aside>
    </>
  )
}
