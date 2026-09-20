'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Boxes,
  LayoutDashboard,
  LockKeyhole,
  ScanSearch,
  UnlockKeyhole,
  WifiOff,
} from 'lucide-react'

import { VaultMark, WatermarkWave } from '@/components/vault-mark'
import { cn } from '@/lib/utils'

const nav = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/encrypt', label: 'Encrypt', icon: LockKeyhole },
  { href: '/decrypt', label: 'Decrypt', icon: UnlockKeyhole },
  { href: '/trace', label: 'Trace', icon: ScanSearch },
  { href: '/ledger', label: 'Ledger', icon: Boxes },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname()

  return (
    <div className="relative min-h-screen font-sans text-foreground">
      <div className="atmosphere" aria-hidden="true" />
      <div className="tape pointer-events-none fixed top-0 left-0 z-20 h-full w-1.5" aria-hidden="true" />

      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <div className="relative z-10">
        <header className="border-b border-white/6 bg-[oklch(0.16_0.03_48_/_0.72)] backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <Link href="/" className="flex items-center gap-3 rounded-xl focus-visible:ring-2">
              <VaultMark className="size-10" />
              <span>
                <span className="block font-serif text-xl tracking-tight text-primary">Provena</span>
                <span className="block text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
                  Forensic archive
                </span>
              </span>
            </Link>

            <p className="hidden items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1.5 text-xs text-primary sm:inline-flex">
              <WifiOff className="size-3.5" aria-hidden="true" />
              Air-gapped
              <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
              <span className="sr-only">Operational</span>
            </p>
          </div>
        </header>

        <nav aria-label="Primary" className="sticky top-0 z-30 border-b border-white/6 bg-[oklch(0.16_0.03_48_/_0.78)] backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2 sm:px-6">
            {nav.map(({ href, label, icon: Icon }) => {
              const active = path === href
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground shadow-[0_10px_24px_oklch(0.84_0.13_82_/_0.18)]'
                      : 'text-muted-foreground hover:bg-white/5 hover:text-foreground',
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                </Link>
              )
            })}
          </div>
        </nav>

        <main id="main-content" className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-12">
          <WatermarkWave />
          {children}
        </main>
      </div>
    </div>
  )
}

export function PageIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="mb-10 max-w-3xl">
      <p className="mb-3 font-serif text-sm italic text-accent">{eyebrow}</p>
      <h1 className="font-serif text-4xl leading-[1.1] tracking-tight text-balance sm:text-5xl">{title}</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">{description}</p>
    </div>
  )
}

export function Panel({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('surface rounded-2xl', className)}>
      <header className="border-b border-white/6 px-5 py-4 sm:px-6">
        <h2 className="font-serif text-xl text-foreground">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </header>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  )
}

export function StatusDot({ good = true, label }: { good?: boolean; label?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={cn('inline-block size-2 rounded-full', good ? 'bg-success' : 'bg-destructive')}
        aria-hidden="true"
      />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  )
}

export function HashText({ value }: { value: string }) {
  return (
    <code className="break-all font-mono text-xs tracking-wide text-accent">{value}</code>
  )
}
