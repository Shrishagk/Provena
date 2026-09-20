'use client'

import { useEffect, useState } from 'react'
import { Check, Download, KeyRound } from 'lucide-react'

import { AppShell, HashText, PageIntro, Panel } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { UploadZone } from '@/components/upload-zone'
import { cn } from '@/lib/utils'
import { decryptDocument, downloadText, getRecipients, type Recipient } from '@/lib/api'

const steps = ['Decrypting', 'Generating watermark', 'Signing ML-DSA record', 'Reaching ledger quorum', 'Ready']

export default function DecryptPage() {
  const [file, setFile] = useState<File | null>(null)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [recipient, setRecipient] = useState('')
  const [result, setResult] = useState<Awaited<ReturnType<typeof decryptDocument>> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getRecipients()
      .then(({ recipients }) => {
        setRecipients(recipients)
        setRecipient(recipients[0]?.id ?? '')
      })
      .catch(() => setError('Gateway unavailable: identities could not be loaded.'))
  }, [])

  async function submit() {
    if (!file || !recipient) return
    setBusy(true)
    setError('')
    try {
      setResult(await decryptDocument(file, recipient))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Decryption failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell>
      <PageIntro
        eyebrow="Recipient workflow"
        title="Issue a fingerprinted copy."
        description="Demo mode: the gateway decrypts, renders a marker, signs the record with its locally held recipient key, and commits it to the ledger quorum."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Panel title="Decryption request">
          <label className="mb-2 block text-sm font-medium" htmlFor="recipient">
            Recipient identity
          </label>
          <select
            id="recipient"
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            className="mb-6 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm"
          >
            {recipients.map((item) => (
              <option key={item.id} value={item.id}>
                {item.display_name} · {item.id}
              </option>
            ))}
          </select>

          <UploadZone label="Drop encrypted package" file={file} onFile={setFile} />

          <Button onClick={submit} disabled={!file || !recipient || busy} size="lg" className="mt-6">
            <KeyRound />
            {busy ? 'Processing…' : 'Decrypt, watermark, sign, and commit'}
          </Button>
          {error ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </Panel>

        <Panel title="Demo processing" description="Gateway custody means this is not recipient non-repudiation">
          <ol className="flex flex-col gap-4">
            {steps.map((step, index) => {
              const done = Boolean(result) && index < 4
              const current = Boolean(result) && index === 4
              return (
                <li key={step} className="flex items-center gap-3 text-sm">
                  <span
                    className={cn(
                      'grid size-8 place-items-center rounded-full font-mono text-xs',
                      current
                        ? 'bg-success text-primary-foreground'
                        : done
                          ? 'bg-accent/20 text-accent'
                          : 'bg-muted text-muted-foreground',
                    )}
                    aria-hidden="true"
                  >
                    {done ? <Check className="size-3.5" /> : index + 1}
                  </span>
                  <span className={done || current ? 'text-foreground' : 'text-muted-foreground'}>{step}</span>
                </li>
              )
            })}
          </ol>
        </Panel>
      </div>

      {result ? (
        <Panel title="Fingerprint copy ready" className="mt-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Watermark session</p>
              <p className="mt-2">
                <HashText value={result.watermark_session_id} />
              </p>
              <p className="mt-4 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Ledger entry hash</p>
              <p className="mt-2">
                <HashText value={result.ledger_entry_hash} />
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Committed by</p>
              <p className="mt-2 font-serif text-lg">{result.committed_nodes.join(' · ')}</p>
              <Button className="mt-5" onClick={() => downloadText(result.watermarked_copy_url)}>
                <Download />
                Download fingerprinted copy
              </Button>
            </div>
          </div>
        </Panel>
      ) : null}
    </AppShell>
  )
}
