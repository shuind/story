"use client"

import { useEffect, useRef, useState } from "react"

export interface InputDialogField {
  key: string
  label: string
  placeholder?: string
  required?: boolean
  multiline?: boolean
}

interface Props {
  open: boolean
  title: string
  description?: string
  fields: InputDialogField[]
  submitLabel: string
  onClose: () => void
  onSubmit: (values: Record<string, string>) => Promise<void> | void
}

export function InputDialog({ open, title, description, fields, submitLabel, onClose, onSubmit }: Props) {
  const firstInputRef = useRef<HTMLInputElement>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setValues(Object.fromEntries(fields.map((field) => [field.key, ""])))
    setError(null)
    requestAnimationFrame(() => firstInputRef.current?.focus())
  }, [fields, open])

  if (!open) return null

  const submit = async () => {
    const missing = fields.find((field) => field.required && !values[field.key]?.trim())
    if (missing) {
      setError(`请填写${missing.label}`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSubmit(values)
      onClose()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "操作失败，请稍后重试")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button type="button" aria-label="关闭对话框" onClick={saving ? undefined : onClose} className="fixed inset-0 z-[60] cursor-default bg-foreground/20 backdrop-blur-[2px]" />
      <section role="dialog" aria-modal="true" aria-label={title} className="fixed left-1/2 top-1/2 z-[70] w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-faint bg-surface p-6 shadow-2xl">
        <div className="mb-5">
          <h2 className="font-serif text-lg font-semibold">{title}</h2>
          {description && <p className="mt-1.5 text-xs leading-5 text-muted">{description}</p>}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
          className="space-y-4"
        >
          {fields.map((field, index) => {
            const value = values[field.key] ?? ""
            const className = "mt-1.5 w-full rounded-xl border border-faint bg-background/50 px-3 py-2.5 text-sm outline-none placeholder:text-muted/50 focus:border-accent"
            const update = (nextValue: string) => setValues((current) => ({ ...current, [field.key]: nextValue }))
            return (
              <label key={field.key} className="block text-xs text-muted">
                {field.label}
                {field.multiline ? (
                  <textarea value={value} onChange={(event) => update(event.target.value)} placeholder={field.placeholder} className={className} rows={3} />
                ) : (
                  <input ref={index === 0 ? firstInputRef : undefined} value={value} onChange={(event) => update(event.target.value)} placeholder={field.placeholder} className={className} />
                )}
              </label>
            )
          })}
          {error && <p className="rounded-xl bg-accent/5 px-3 py-2 text-xs text-accent">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" disabled={saving} onClick={onClose} className="rounded-xl px-3.5 py-2 text-xs text-muted hover:bg-background hover:text-foreground">
              取消
            </button>
            <button type="submit" disabled={saving} className="rounded-xl bg-foreground px-4 py-2 text-xs text-background hover:opacity-90 disabled:opacity-50">
              {saving ? "处理中…" : submitLabel}
            </button>
          </div>
        </form>
      </section>
    </>
  )
}
