'use client'

import { useEffect, useState } from 'react'
import { Check, Download, KeyRound } from 'lucide-react'
import { AppShell, PageIntro, Panel } from '@/components/app-shell'
import { UploadZone } from '@/components/upload-zone'
import { decryptDocument, downloadText, getRecipients, type Recipient } from '@/lib/api'

const steps = ['Decrypting', 'Generating watermark', 'Signing ML-DSA record', 'Reaching ledger quorum', 'Ready']

export default function DecryptPage() {
  const [file, setFile] = useState<File | null>(null)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [recipient, setRecipient] = useState('')
  const [result, setResult] = useState<Awaited<ReturnType<typeof decryptDocument>> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { getRecipients().then(({ recipients }) => { setRecipients(recipients); setRecipient(recipients[0]?.id ?? '') }).catch(() => setError('Gateway unavailable: identities could not be loaded.')) }, [])
  async function submit() { if (!file || !recipient) return; setBusy(true); setError(''); try { setResult(await decryptDocument(file, recipient)) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Decryption failed.') } finally { setBusy(false) } }
  return <AppShell><PageIntro eyebrow="Recipient workflow" title="Create a fingerprinted copy" description="The backend decrypts, renders a unique invisible marker, signs the attribution record, and commits it to the ledger quorum." /><div className="grid gap-6 lg:grid-cols-[1fr_360px]"><Panel title="Decryption request"><label className="mb-2 block text-sm font-medium" htmlFor="recipient">Recipient identity</label><select id="recipient" value={recipient} onChange={(event) => setRecipient(event.target.value)} className="mb-6 w-full rounded-lg border border-slate-700 bg-[#091625] px-3 py-3 text-sm">{recipients.map((item) => <option key={item.id} value={item.id}>{item.display_name} · {item.id}</option>)}</select><UploadZone label="Drop encrypted package" file={file} onFile={setFile} /><button onClick={submit} disabled={!file || !recipient || busy} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-40"><KeyRound className="size-4" />{busy ? 'Processing…' : 'Decrypt, watermark, sign, and commit'}</button>{error && <p className="mt-3 text-sm text-rose-300">{error}</p>}</Panel><Panel title="Secure processing"><div className="flex flex-col gap-4">{steps.map((step, index) => <div key={step} className="flex items-center gap-3 text-sm"><span className={`grid size-6 place-items-center rounded-full text-xs ${result && index === 4 ? 'bg-emerald-400 text-slate-950' : result && index < 4 ? 'bg-cyan-300/20 text-cyan-300' : 'bg-slate-800 text-slate-500'}`}>{result && index < 4 ? <Check className="size-3" /> : index + 1}</span><span className={result && index < 4 ? 'text-slate-200' : 'text-slate-500'}>{step}</span></div>)}</div></Panel></div>{result && <Panel title="Fingerprint copy ready" className="mt-6"><div className="grid gap-5 sm:grid-cols-2"><div><p className="text-xs text-slate-500">Watermark session</p><p className="mt-2 font-mono text-sm text-cyan-300">{result.watermark_session_id}</p><p className="mt-4 text-xs text-slate-500">Ledger entry hash</p><p className="mt-2 font-mono text-sm text-cyan-300">{result.ledger_entry_hash}</p></div><div><p className="text-xs text-slate-500">Committed by</p><p className="mt-2 text-sm">{result.committed_nodes.join(' · ')}</p><button onClick={() => downloadText(result.watermarked_copy_url)} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950"><Download className="size-4" />Download fingerprinted copy</button></div></div></Panel>}</AppShell>
}
