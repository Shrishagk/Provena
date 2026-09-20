export type LedgerNodeStatus = {
  node_id: 'node1' | 'node2' | 'node3'
  online: boolean
  valid?: boolean
  tip?: string
  entries?: number
  errors?: string[]
}

export type EncryptResponse = { envelope_id: string; ciphertext_sha256: string; recipient_count: number; download_url: string }
export type DecryptResponse = { watermarked_copy_url: string; watermark_session_id: string; ledger_entry_hash: string; committed_nodes: string[]; assurance: 'gateway-custody-demo' }
export type TraceResponse = { watermark_session_id?: string; recipient_id?: string; timestamp?: string; ledger_entry_hash?: string; keyring_signature_valid: boolean; recipient_ml_dsa_signature_valid: boolean; document_ciphertext_binding_valid: boolean; ledger_chain_and_quorum_valid: boolean; verdict: 'ATTRIBUTION VERIFIED' | 'ATTRIBUTION NOT VERIFIED' | 'NO WATERMARK FOUND'; assurance: 'gateway-custody-demo' }
export type LedgerResponse = { quorum_agreement: boolean; replicas: LedgerNodeStatus[] }
export type Recipient = { id: string; display_name: string }
export type TrustBoundary = {
  mode: 'gateway-custody-demo'
  recipient_private_keys: string
  recipient_non_repudiation: boolean
  replica_deployment: string
  independent_administration: boolean
}

const base = process.env.NEXT_PUBLIC_API_BASE_URL || ''
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${base}${path}`, init)
  } catch (cause) {
    const gateway = base || 'this site'
    throw new Error(`Cannot reach the gateway at ${gateway}. Start the gateway and confirm its address in .env.local.`, { cause })
  }
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null)
    const detail = typeof payload === 'object' && payload !== null && 'detail' in payload
      ? (payload as { detail?: unknown }).detail
      : null
    throw new Error(typeof detail === 'string' ? detail : `Request failed: ${response.status}`)
  }
  return response.json()
}
export const getLedgerStatus = () => request<LedgerResponse>('/api/v1/ledger/status')
export const verifyLedger = () => request<LedgerResponse>('/api/v1/ledger/verify', { method: 'POST' })
export const getRecipients = () => request<{ recipients: Recipient[] }>('/api/v1/recipients')
export const getTrustBoundary = () => request<TrustBoundary>('/api/v1/system/trust-boundary')
export function encryptDocument(document: File, recipients: string[]) { const body = new FormData(); body.append('document', document); body.append('recipients', JSON.stringify(recipients)); return request<EncryptResponse>('/api/v1/documents/encrypt', { method: 'POST', body }) }
export function decryptDocument(envelope: File, recipient_id: string) { const body = new FormData(); body.append('envelope', envelope); body.append('recipient_id', recipient_id); return request<DecryptResponse>('/api/v1/decryptions', { method: 'POST', body }) }
export function traceLeak(leaked_copy: File, envelope: File) { const body = new FormData(); body.append('leaked_copy', leaked_copy); body.append('envelope', envelope); return request<TraceResponse>('/api/v1/leak-trace', { method: 'POST', body }) }

export const MOCK_LEDGER: LedgerResponse = { quorum_agreement: true, replicas: [
  { node_id: 'node1', online: true, valid: true, tip: 'a83f…91c2', entries: 1842 },
  { node_id: 'node2', online: true, valid: true, tip: 'a83f…91c2', entries: 1842 },
  { node_id: 'node3', online: true, valid: true, tip: 'a83f…91c2', entries: 1842 },
] }
export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === 'true'
export function shorten(value = '', length = 14) { return value.length > length ? `${value.slice(0, length / 2)}…${value.slice(-length / 2)}` : value }
export function downloadJson(name: string, value: unknown) { const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url) }
export function downloadText(url: string) { const a = document.createElement('a'); a.href = url.startsWith('http') ? url : `${base}${url}`; a.download = ''; a.click() }
