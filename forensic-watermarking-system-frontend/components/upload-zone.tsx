'use client'

import { useId, useState } from 'react'
import { FileText, UploadCloud } from 'lucide-react'

import { cn } from '@/lib/utils'

export function UploadZone({
  label,
  file,
  onFile,
}: {
  label: string
  file: File | null
  onFile: (file: File | null) => void
}) {
  const inputId = useId()
  const hintId = useId()
  const [drag, setDrag] = useState(false)

  return (
    <div>
      <input
        id={inputId}
        type="file"
        accept=".txt,.json,.pqe"
        className="sr-only"
        aria-describedby={hintId}
        onChange={(event) => onFile(event.target.files?.[0] || null)}
      />
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDrag(false)
          onFile(event.dataTransfer.files[0] || null)
        }}
        className={cn(
          'block cursor-pointer rounded-2xl border border-dashed p-8 text-center transition-colors',
          drag
            ? 'border-primary bg-primary/10'
            : 'border-primary/25 bg-black/20 hover:border-accent/50 hover:bg-accent/5',
        )}
      >
        {file ? (
          <>
            <FileText className="mx-auto size-8 text-primary" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium">{file.name}</p>
            <p id={hintId} className="mt-1 text-xs text-muted-foreground">
              {(file.size / 1024).toFixed(1)} KB · Click or press Enter to replace
            </p>
          </>
        ) : (
          <>
            <UploadCloud className="mx-auto size-8 text-accent" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium">{label}</p>
            <p id={hintId} className="mt-1 text-xs text-muted-foreground">
              Drag and drop, or browse. Accepted: .txt, .json, .pqe
            </p>
          </>
        )}
      </label>
    </div>
  )
}
