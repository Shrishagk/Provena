'use client'

import { useEffect, useState } from 'react'
import { Activity, CheckCircle2, Server, TriangleAlert } from 'lucide-react'

import { AppShell, HashText, PageIntro, Panel, StatusDot } from '@/components/app-shell'
import { getLedgerStatus, getTrustBoundary, type LedgerResponse, type TrustBoundary } from '@/lib/api'

export default function Page() {
  const [ledger, setLedger] = useState<LedgerResponse | null>(null)
  const [trust, setTrust] = useState<TrustBoundary | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getLedgerStatus(), getTrustBoundary()])
      .then(([status, boundary]) => {
        setLedger(status)
        setTrust(boundary)
      })
      .catch(() => setError('Live system status is unavailable. No placeholder ledger values are shown.'))
  }, [])

  const online = ledger?.replicas.filter((node) => node.online).length
  const agreeing = ledger?.quorum_agreement ? 'Confirmed' : ledger ? 'Not established' : 'Checking'

  return (
    <AppShell>
      <PageIntro
        eyebrow="Chain of custody"
        title="The archive that remembers every copy."
        description="Live ledger health is queried from the local gateway. This prototype exposes its custody and deployment limits alongside its cryptographic checks."
      />

      {error ? <p role="alert" className="mb-5 text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <article className="surface rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Ledger replicas</p>
            <Server className="size-4 text-accent" aria-hidden="true" />
          </div>
          <p className="mt-5 font-serif text-4xl">{online === undefined ? '...' : `${online} / 3`}</p>
          <p className="mt-2 text-xs text-muted-foreground">Live response count</p>
        </article>
        <article className="surface rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">2-of-3 quorum</p>
            <CheckCircle2 className="size-4 text-accent" aria-hidden="true" />
          </div>
          <p className="mt-5 font-serif text-4xl">{agreeing}</p>
          <p className="mt-2 text-xs text-muted-foreground">Based on matching valid chain tips</p>
        </article>
        <article className="surface rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Private-key custody</p>
            <Activity className="size-4 text-accent" aria-hidden="true" />
          </div>
          <p className="mt-5 font-serif text-2xl">{trust ? 'Gateway-held demo keys' : 'Checking'}</p>
          <p className="mt-2 text-xs text-muted-foreground">Not recipient non-repudiation</p>
        </article>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <Panel title="Replica health" description="Live data from /api/v1/ledger/status">
          <div className="grid gap-3 sm:grid-cols-3">
            {ledger?.replicas.map((node) => (
              <article key={node.node_id} className="rounded-xl border border-white/8 bg-black/20 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm">{node.node_id}</span>
                  <span className={node.online ? 'inline-flex items-center gap-2 text-xs text-success' : 'inline-flex items-center gap-2 text-xs text-destructive'}>
                    <StatusDot good={node.online} label={`${node.node_id} ${node.online ? 'online' : 'offline'}`} />
                    {node.online ? 'Live' : 'Offline'}
                  </span>
                </div>
                <p className="mt-5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Height</p>
                <p className="mt-1 font-serif text-2xl">{node.entries ?? 'Unavailable'}</p>
                <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Tip</p>
                <p className="mt-1"><HashText value={node.tip || 'Unavailable'} /></p>
              </article>
            )) ?? <p className="text-sm text-muted-foreground">Waiting for live replica status.</p>}
          </div>
        </Panel>

        <Panel title="Prototype trust boundary">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-1 size-5 shrink-0 text-accent" aria-hidden="true" />
            <div className="text-sm leading-6 text-muted-foreground">
              <p>The browser workflow uses recipient private keys held by the local gateway. Its ML-DSA record is technically valid, but it cannot prove the recipient personally performed the action.</p>
              <p className="mt-3">The three replicas are separate local processes by default, not independently administered organizations. The quorum detects replica disagreement and tolerates one unavailable process; it does not protect against the host administrator.</p>
            </div>
          </div>
        </Panel>
      </div>
    </AppShell>
  )
}
