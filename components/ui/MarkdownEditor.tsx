'use client'

import { useRef, useState } from 'react'
import MarkdownContent from './MarkdownContent'

type Format = 'bold' | 'italic' | 'heading' | 'bullet' | 'numbered' | 'link' | 'quote'
const formats: { format: Format; label: string }[] = [
  { format: 'bold', label: 'Bold' }, { format: 'italic', label: 'Italic' },
  { format: 'heading', label: 'Heading' }, { format: 'bullet', label: 'Bullet list' },
  { format: 'numbered', label: 'Numbered list' }, { format: 'link', label: 'Link' }, { format: 'quote', label: 'Quote' },
]

export default function MarkdownEditor({ id, label, value, onChange, disabled = false, error }: { id: string; label: string; value: string; onChange: (value: string) => void; disabled?: boolean; error?: string }) {
  const [preview, setPreview] = useState(false)
  const showPreview = preview && !error
  const textarea = useRef<HTMLTextAreaElement>(null)
  function formatSelection(format: Format) {
    const editor = textarea.current
    if (!editor) return
    let start = editor.selectionStart
    const end = editor.selectionEnd
    const block = ['heading', 'bullet', 'numbered', 'quote'].includes(format)
    if (block) start = start === 0 ? 0 : value.lastIndexOf('\n', start - 1) + 1
    const selected = value.slice(start, end) || (format === 'heading' ? 'Heading' : format === 'link' ? 'Link text' : 'Text')
    let replacement: string
    if (format === 'bold') replacement = `**${selected}**`
    else if (format === 'italic') replacement = `*${selected}*`
    else if (format === 'link') replacement = `[${selected}](https://example.com)`
    else replacement = selected.split('\n').map((line, index) => `${format === 'heading' ? '## ' : format === 'bullet' ? '- ' : format === 'numbered' ? `${index + 1}. ` : '> '}${line}`).join('\n')
    const next = value.slice(0, start) + replacement + value.slice(end)
    if (next.length > 20000) return
    setPreview(false)
    onChange(next)
    requestAnimationFrame(() => { editor.focus(); editor.setSelectionRange(start, start + replacement.length) })
  }
  return <section id={`${id}-section`} tabIndex={-1} aria-labelledby={`${id}-label`} className={`scroll-mt-24 space-y-2 rounded-lg ${error ? 'border border-red-300 bg-red-50 p-3' : ''}`}>
    <label id={`${id}-label`} htmlFor={id} className="block text-sm font-medium">{label}</label>
    <div className="overflow-hidden rounded-xl border border-gray-300 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b bg-gray-50 p-2">
        <div className="flex gap-1" role="group" aria-label={`${label} editor mode`}>
          {['Write', 'Preview'].map((mode, index) => <button key={mode} type="button" disabled={disabled || (index === 1 && !!error)} aria-pressed={showPreview === !!index} onClick={() => setPreview(!!index)} className={`rounded-md px-3 py-1.5 text-sm disabled:opacity-50 ${showPreview === !!index ? 'bg-red-800 text-white' : 'bg-white text-gray-700'}`}>{mode}</button>)}
        </div>
        {!showPreview && <div className="flex flex-wrap gap-1" role="group" aria-label={`${label} formatting`}>
          {formats.map(item => <button key={item.format} type="button" disabled={disabled} onClick={() => formatSelection(item.format)} className="rounded-md border bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50">{item.label}</button>)}
        </div>}
      </div>
      {showPreview ? <div className="min-h-[240px] p-4" aria-label={`${label} preview`}>{value.trim() ? <MarkdownContent content={value} /> : <p className="text-sm text-gray-500">Nothing to preview yet.</p>}</div> : <textarea ref={textarea} id={id} aria-invalid={!!error} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`} disabled={disabled} value={value} onChange={event => { setPreview(false); onChange(event.target.value) }} maxLength={20000} rows={10} className="block w-full resize-y bg-white p-4 font-mono text-sm leading-6 text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-red-100 disabled:bg-gray-50" placeholder="Write your approved notice using Markdown…" />}
    </div>
    {error && <p id={`${id}-error`} className="text-sm text-red-800">{error}</p>}
    <p id={`${id}-help`} className="text-xs text-gray-500">Markdown supports headings, bold, lists, links and tables. Preview shows the website formatting. {value.length.toLocaleString()} / 20,000 characters.</p>
  </section>
}
