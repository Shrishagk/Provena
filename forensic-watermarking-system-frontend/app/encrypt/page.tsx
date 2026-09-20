'use client'

import { useEffect, useState } from 'react'
import { Download, LockKeyhole, Users } from 'lucide-react'

import { AppShell, HashText, PageIntro, Panel } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { UploadZone } from '@/components/upload-zone'
import { useEncryptWorkflow } from '@/components/workflow-state'
import { downloadText, encryptDocument, getRecipients, type Recipient } from '@/lib/api'

const steps = [
  { n: '01', title: 'One ciphertext', body: 'The source is sealed exactly once.' },
  { n: '02', title: 'Recipient wrapping', body: 'Each identity receives an ML-KEM-wrapped key share.' },
  { n: '03', title: 'Public-key packaging', body: 'The gateway needs recipient public keys only to create a package.' },
]

export default function EncryptPage() {
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const { file, selected, result, sourceFile, hydrated, setFile, setResult, setSelected } = useEncryptWorkflow()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!hydrated) return

    getRecipients()
      .then(({ recipients }) => {
        setRecipients(recipients)
        setSelected((current) => current.length ? current : recipients.slice(0, 2).map((recipient) => recipient.id))
      })
      .catch(() => setError('Gateway unavailable: recipients could not be loaded.'))
  }, [hydrated, setSelected])

  async function submit() {
    if (!file || !selected.length) return
    setBusy(true)
    setError('')
    try {
      setResult(await encryptDocument(file, selected))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Encryption failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell>
      <PageIntro
        eyebrow="Distribution package"
        title="Encrypt once. Distribute with intent."
        description="Create one ciphertext for every authorized recipient. This operation uses the signed recipient public-key registry; it does not require a recipient private key."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Panel title="Source document" description="UTF-8 text documents only">
          <UploadZone label="Drop source .txt document" file={file} onFile={setFile} />
          {!file && sourceFile ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Previous source: {sourceFile.name} ({(sourceFile.size / 1024).toFixed(1)} KB). Choose it again only to create a new package.
            </p>
          ) : null}

          <fieldset className="mt-6">
            <legend className="mb-3 inline-flex items-center gap-2 text-sm font-medium">
              <Users className="size-4 text-accent" aria-hidden="true" />
              Authorized recipients
            </legend>
            <div className="grid gap-2">
              {!recipients.length ? (
                <p className="rounded-xl border border-dashed border-white/10 px-4 py-3 text-sm text-muted-foreground">
                  Recipient identities appear when the gateway is reachable.
                </p>
              ) : null}
              {recipients.map((recipient) => (
                <label
                  key={recipient.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/8 bg-black/20 px-4 py-3 text-sm has-[:focus-visible]:ring-2 has-[:checked]:border-primary/40 has-[:checked]:bg-primary/8"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(recipient.id)}
                    onChange={(event) =>
                      setSelected(
                        event.target.checked
                          ? [...selected, recipient.id]
                          : selected.filter((id) => id !== recipient.id),
                      )
                    }
                    className="size-4 accent-[oklch(0.84_0.13_82)]"
                  />
                  {recipient.display_name}
                  <span className="ml-auto font-mono text-xs text-muted-foreground">{recipient.id}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <Button onClick={submit} disabled={!file || !selected.length || busy} size="lg" className="mt-6">
            <LockKeyhole />
            {busy ? 'Encrypting…' : 'Encrypt and create package'}
          </Button>
          {error ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </Panel>

        <Panel title="How custody works">
          <ol className="flex flex-col gap-5">
            {steps.map((step) => (
              <li key={step.n} className="border-l-2 border-primary/30 pl-4">
                <p className="font-mono text-[11px] tracking-[0.2em] text-primary">{step.n}</p>
                <p className="mt-1 font-serif text-lg">{step.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      {result ? (
        <Panel title="Package ready" className="mt-6">
          <div className="grid gap-5 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Ciphertext SHA-256</p>
              <p className="mt-2">
                <HashText value={result.ciphertext_sha256} />
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Recipients</p>
              <p className="mt-1 font-serif text-3xl">{result.recipient_count}</p>
            </div>
            <Button variant="outline" onClick={() => downloadText(result.download_url)}>
              <Download />
              Download package
            </Button>
          </div>
        </Panel>
      ) : null}
    </AppShell>
  )
}
