'use client'

import { useState } from 'react'
import { CheckCircle2, FileCheck2, ScanSearch, XCircle } from 'lucide-react'

import { AppShell, HashText, PageIntro, Panel } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { UploadZone } from '@/components/upload-zone'
import { cn } from '@/lib/utils'
import { downloadJson, traceLeak, type TraceResponse } from '@/lib/api'

const checks: [string, keyof TraceResponse][] = [
  ['Signed keyring valid', 'keyring_signature_valid'],
  ['ML-DSA recipient signature valid', 'recipient_ml_dsa_signature_valid'],
  ['Ciphertext binding valid', 'document_ciphertext_binding_valid'],
  ['2-of-3 ledger quorum valid', 'ledger_chain_and_quorum_valid'],
]

export default function TracePage() {
  const [leaked, setLeaked] = useState<File | null>(null)
  const [envelope, setEnvelope] = useState<File | null>(null)
  const [result, setResult] = useState<TraceResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!leaked || !envelope) return
    setBusy(true)
    setError('')
    try {
      setResult(await traceLeak(leaked, envelope))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Trace failed.')
    } finally {
      setBusy(false)
    }
  }

  const verified = result?.verdict === 'ATTRIBUTION VERIFIED'

  return (
    <AppShell>
      <PageIntro
        eyebrow="Forensic investigation"
        title="Trace the copy back to a person."
        description="Compare a leaked text copy with its original distribution package. The gateway verifies public evidence; recipient private keys remain in the local recipient agent."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Evidence intake">
          <UploadZone label="Drop suspected leaked .txt" file={leaked} onFile={setLeaked} />
          <p className="my-4 text-center font-serif text-sm italic text-accent">and the original package</p>
          <UploadZone label="Drop original encrypted package" file={envelope} onFile={setEnvelope} />
          <Button onClick={submit} disabled={!leaked || !envelope || busy} size="lg" className="mt-6">
            <ScanSearch />
            {busy ? 'Analyzing…' : 'Trace leak'}
          </Button>
          {error ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </Panel>

        <Panel title="Verification evidence" description="All checks are evaluated by the backend; legal non-repudiation still requires hardware-backed identity controls">
          <ul className="flex flex-col gap-3">
            {checks.map(([label, key]) => {
              const valid = result?.[key]
              return (
                <li
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/20 px-4 py-3"
                >
                  <span className="text-sm">{label}</span>
                  {result ? (
                    <span className={cn('inline-flex items-center gap-2 text-xs', valid ? 'text-success' : 'text-destructive')}>
                      {valid ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <XCircle className="size-4" aria-hidden="true" />}
                      {valid ? 'Valid' : 'Invalid'}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Pending</span>
                  )}
                </li>
              )
            })}
          </ul>
        </Panel>
      </div>

      {result ? (
        <Panel title="Attribution result" className="mt-6">
          <div
            className={cn(
              'rounded-2xl border p-5',
              verified ? 'border-success/30 bg-success/8' : 'border-destructive/30 bg-destructive/8',
            )}
          >
            <div className="flex items-center gap-3">
              <FileCheck2 className={cn('size-7', verified ? 'text-success' : 'text-destructive')} aria-hidden="true" />
              <p className="font-serif text-2xl">
                {result.verdict.replaceAll('ATTRIBUTION ', 'Attribution ').replace('NO WATERMARK FOUND', 'No watermark found')}
              </p>
            </div>
            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Recipient ID</dt>
                <dd className="mt-1 font-mono">{result.recipient_id || '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Timestamp</dt>
                <dd className="mt-1">{result.timestamp || '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Watermark session</dt>
                <dd className="mt-1">
                  <HashText value={result.watermark_session_id || '—'} />
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Ledger entry hash</dt>
                <dd className="mt-1">
                  <HashText value={result.ledger_entry_hash || '—'} />
                </dd>
              </div>
            </dl>
            <Button variant="outline" className="mt-6" onClick={() => downloadJson('verification-report.json', result)}>
              Download JSON verification report
            </Button>
          </div>
        </Panel>
      ) : null}
    </AppShell>
  )
}
