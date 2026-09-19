'use client'

import { useRef, useState } from 'react'
import { FileText, UploadCloud } from 'lucide-react'

export function UploadZone({ label, file, onFile }: { label: string; file: File | null; onFile: (file: File | null) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  return <div onClick={() => ref.current?.click()} onDragOver={(event) => { event.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={(event) => { event.preventDefault(); setDrag(false); onFile(event.dataTransfer.files[0] || null) }} className={`cursor-pointer rounded-xl border border-dashed p-8 text-center transition-colors ${drag ? 'border-cyan-300 bg-cyan-300/10' : 'border-slate-700 bg-[#091625] hover:border-cyan-400/60'}`}>
    <input ref={ref} type="file" accept=".txt,.json,.pqe" className="hidden" onChange={(event) => onFile(event.target.files?.[0] || null)} />
    {file ? <><FileText className="mx-auto size-8 text-cyan-300" /><p className="mt-3 text-sm font-medium">{file.name}</p><p className="mt-1 text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB · Click to replace</p></> : <><UploadCloud className="mx-auto size-8 text-slate-500" /><p className="mt-3 text-sm font-medium">{label}</p><p className="mt-1 text-xs text-slate-500">Drag and drop or browse</p></>}
  </div>
}
