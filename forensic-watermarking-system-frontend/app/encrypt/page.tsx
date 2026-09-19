'use client'

import { useEffect, useState } from 'react'
import { Download, LockKeyhole, Users } from 'lucide-react'
import { AppShell, PageIntro, Panel } from '@/components/app-shell'
import { UploadZone } from '@/components/upload-zone'
import { downloadText, encryptDocument, getRecipients, type Recipient } from '@/lib/api'

export default function EncryptPage() {
  const [file, setFile] = useState<File | null>(null)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [result, setResult] = useState<Awaited<ReturnType<typeof encryptDocument>> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getRecipients()
      .then(({ recipients }) => {
        setRecipients(recipients)
        setSelected(recipients.slice(0, 2).map((recipient) => recipient.id))
      })
      .catch(() => setError('Gateway unavailable: recipients could not be loaded.'))
  }, [])

  async function submit() {
    if (!file || !selected.length) return
    setBusy(true); setError('')
    try { setResult(await encryptDocument(file, selected)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Encryption failed.') }
    finally { setBusy(false) }
  }

  return <AppShell>
    <PageIntro eyebrow="Distribution package" title="Encrypt once. Distribute safely." description="Create one ciphertext for every authorized recipient. Per-recipient ML-KEM wrapping is performed by the backend gateway." />
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Panel title="Source document" description="Only UTF-8 text documents are accepted">
        <UploadZone label="Drop source .txt document" file={file} onFile={setFile} />
        <div className="mt-6"><div className="mb-3 flex items-center gap-2 text-sm font-medium"><Users className="size-4 text-cyan-300" />Authorized recipients</div>
          <div className="grid gap-2">{recipients.map((recipient) => <label key={recipient.id} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-[#091625] px-4 py-3 text-sm"><input type="checkbox" checked={selected.includes(recipient.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, recipient.id] : selected.filter((id) => id !== recipient.id))} className="accent-cyan-400" />{recipient.display_name}<span className="ml-auto font-mono text-xs text-slate-500">{recipient.id}</span></label>)}</div>
        </div>
        <button onClick={submit} disabled={!file || !selected.length || busy} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"><LockKeyhole className="size-4" />{busy ? 'Encrypting…' : 'Encrypt and create distribution package'}</button>
        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      </Panel>
      <Panel title="How it works"><div className="flex flex-col gap-5 text-sm text-slate-400"><p><strong className="text-slate-200">01 · One ciphertext</strong><br />The document is encrypted exactly once.</p><p><strong className="text-slate-200">02 · Recipient wrapping</strong><br />Each recipient receives an ML-KEM-wrapped key share.</p><p><strong className="text-slate-200">03 · No browser cryptography</strong><br />Keys, encryption, and package creation remain in the gateway.</p></div></Panel>
    </div>
    {result && <Panel title="Distribution package ready" className="mt-6"><div className="grid gap-4 sm:grid-cols-3"><div><p className="text-xs text-slate-500">Ciphertext SHA-256</p><p className="mt-2 break-all font-mono text-xs text-cyan-300">{result.ciphertext_sha256}</p></div><div><p className="text-xs text-slate-500">Recipients</p><p className="mt-2 text-2xl font-semibold">{result.recipient_count}</p></div><button onClick={() => downloadText(result.download_url)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-400/40 px-4 py-2 text-sm text-cyan-300"><Download className="size-4" />Download package</button></div></Panel>}
  </AppShell>
}
