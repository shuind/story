"use client"

import type { PluginDef } from "@/lib/types"

interface Props {
  plugin: PluginDef | null
  onClose: () => void
  onOpenElement: (elementId: string) => void
}

export function PluginDrawer({ plugin, onClose, onOpenElement }: Props) {
  return (
    <>
      {plugin && (
        <button type="button" aria-label="关闭维度" onClick={onClose} className="fixed inset-0 z-40 cursor-default bg-foreground/10" />
      )}
      <aside
        aria-hidden={!plugin}
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col border-l border-faint bg-surface shadow-xl transition-transform duration-300 ease-out ${
          plugin ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {plugin && (
          <>
            <header className="flex items-start gap-3 border-b border-faint px-6 py-5">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] tracking-[0.2em] text-muted">PLUGIN / 维度</p>
                <h2 className="mt-1 font-serif text-xl font-semibold">{plugin.name}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{plugin.description || "还没有维度说明。"}</p>
              </div>
              <button type="button" onClick={onClose} aria-label="关闭维度" className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-faint">
                ×
              </button>
            </header>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="font-serif text-sm font-semibold">维度中的元素</p>
                <span className="text-xs text-muted">{plugin.elements.length} 个</span>
              </div>
              <div className="space-y-2">
                {plugin.elements.map((element) => (
                  <button
                    key={element.id}
                    type="button"
                    onClick={() => onOpenElement(element.id)}
                    className="block w-full rounded border border-faint px-4 py-3 text-left hover:border-accent/50 hover:bg-background/60"
                  >
                    <span className="font-serif text-sm font-semibold">{element.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted">{element.excerpt}</span>
                  </button>
                ))}
                {plugin.elements.length === 0 && <p className="text-xs text-muted">这个维度还没有元素。</p>}
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  )
}
