'use client'

import { useEffect, useState } from 'react'
import { Check, Download, KeyRound } from 'lucide-react'

import { AppShell, HashText, PageIntro, Panel } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { UploadZone } from '@/components/upload-zone'
import { cn } from '@/lib/utils'
import { decryptDocument, downloadRecipientText, getRecipientAgentIdentity, getRecipients, type Recipient } from '@/lib/api'

const steps = ['Decrypting', 'Generating watermark', 'Signing ML-DSA record', 'Reaching ledger quorum', 'Ready']

export default function DecryptPage() {
  const [file, setFile] = useState<File | null>(null)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [recipient, setRecipient] = useState('')
  const [result, setResult] = useState<Awaited<ReturnType<typeof decryptDocument>> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getRecipients(), getRecipientAgentIdentity()])
      .then(([{ recipients }, agent]) => {
        const localRecipient = recipients.filter((item) => item.id === agent.recipient_id)
        if (localRecipient.length !== 1) throw new Error('The local agent identity is not in the gateway’s signed recipient keyring.')
        setRecipients(localRecipient)
        setRecipient(agent.recipient_id)
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Recipient agent unavailable.'))
  }, [])

  async function submit() {
    if (!file || !recipient) return
    setBusy(true)
    setError('')
    try {
      setResult(await decryptDocument(file))
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
        description="Your local recipient agent decrypts, watermarks, and signs with its own private key before committing the record to the ledger quorum."
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
            disabled
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

        <Panel title="Recipient-local processing" description="The gateway never receives this recipient’s private keys">
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
              <Button className="mt-5" onClick={() => downloadRecipientText(result.watermarked_copy_url)}>
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
