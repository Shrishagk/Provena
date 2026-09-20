'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, RefreshCw, Server, TriangleAlert } from 'lucide-react'

import { AppShell, HashText, PageIntro, Panel, StatusDot } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { getLedgerStatus, verifyLedger, type LedgerResponse } from '@/lib/api'
import { cn } from '@/lib/utils'

export default function LedgerPage() {
  const [data, setData] = useState<LedgerResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = async (verify = false) => {
    setBusy(true)
    setError('')
    try {
      setData(await (verify ? verifyLedger() : getLedgerStatus()))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gateway unavailable.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  return (
    <AppShell>
      <PageIntro
        eyebrow="Integrity controls"
        title="Trust the chain, not the screenshot."
        description="Review live replica health and verify the tamper-evident chain before relying on an attribution result."
      />

      {error ? (
        <p role="alert" className="mb-5 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {data && !data.quorum_agreement ? (
        <div
          role="alert"
          className="mb-6 flex items-center gap-3 rounded-2xl border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <TriangleAlert className="size-5 shrink-0" aria-hidden="true" />
          Replica divergence detected. New commits may be paused until quorum agreement is restored.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        {!data && !error
          ? ['node1', 'node2', 'node3'].map((id) => (
              <article key={id} className="surface animate-pulse rounded-2xl p-5" aria-hidden="true">
                <div className="h-9 w-28 rounded-full bg-white/6" />
                <div className="mt-8 h-10 w-16 rounded bg-white/6" />
                <div className="mt-6 h-4 w-full rounded bg-white/6" />
              </article>
            ))
          : null}
        {data?.replicas.map((node) => (
          <article key={node.node_id} className="surface rounded-2xl p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-full bg-accent/12 text-accent">
                  <Server className="size-4" aria-hidden="true" />
                </span>
                <span className="font-mono">{node.node_id}</span>
              </div>
              <span className={cn('inline-flex items-center gap-2 text-xs', node.online ? 'text-success' : 'text-destructive')}>
                <StatusDot good={node.online} label={node.online ? 'Online' : 'Offline'} />
                {node.online ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="mt-7 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Chain height</p>
                <p className="mt-1 font-serif text-3xl">{node.entries ?? '—'}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Validation</p>
                <p className={cn('mt-2 flex items-center gap-1 text-sm', node.valid ? 'text-success' : 'text-muted-foreground')}>
                  {node.valid ? (
                    <>
                      <CheckCircle2 className="size-4" aria-hidden="true" />
                      Valid
                    </>
                  ) : (
                    'Pending'
                  )}
                </p>
              </div>
            </div>
            <p className="mt-5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Tip hash</p>
            <p className="mt-1">
              <HashText value={node.tip || 'Unavailable'} />
            </p>
          </article>
        ))}
      </div>

      <Panel title="Quorum model" description="Why 2-of-3 matters" className="mt-6">
        <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
          This prototype commits only when two of three local replica services agree on the chain tip and signature
          set. They provide quorum availability and divergence detection, but are not independently administered in
          the default single-host deployment.
        </p>
        <Button className="mt-5" onClick={() => void refresh(true)} disabled={busy}>
          <RefreshCw className={busy ? 'animate-spin' : undefined} />
          {busy ? 'Verifying…' : 'Verify ledger integrity'}
        </Button>
      </Panel>
    </AppShell>
  )
}
