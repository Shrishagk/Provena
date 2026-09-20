import type { Metadata, Viewport } from 'next'

import { WorkflowStateProvider } from '@/components/workflow-state'

import './globals.css'

export const metadata: Metadata = {
  title: 'Provena | Forensic Watermarking',
  description: 'Offline post-quantum forensic watermarking control plane.',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#2a2218',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="min-h-screen font-sans antialiased">
        <WorkflowStateProvider>{children}</WorkflowStateProvider>
      </body>
    </html>
  )
}
