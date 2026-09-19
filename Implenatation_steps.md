# Post-Quantum Forensic Watermarking & Leak-Attribution System — Implementation Guide

*Feasible prototype build: the version optimized to actually finish and demo cleanly on a short timeline (roughly 1–2 days), not the fully hardened production design. Each step below notes what to build now vs. what to defer as a "production hardening" note.*

## Overview

A sender encrypts a document once. Each recipient decrypts it independently with their own post-quantum key. At the moment of decryption, a unique invisible watermark is stamped into that recipient's copy, and the recipient signs a record of the event with their own post-quantum signing key. That signed record is committed to a tamper-evident ledger that no single node can rewrite alone. If a copy leaks, you extract the watermark, look it up in the ledger, and produce a cryptographically verifiable report naming the recipient.

**Pipeline:** encrypt → per-recipient decrypt + watermark → sign record → commit to ledger → *(leak)* → extract watermark → ledger lookup → verify signature + chain → attribution report.

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Language | Python 3.10+ | Fastest path to every library below |
| PQ key exchange | ML-KEM (FIPS 203) via `liboqs-python` | Finalized NIST standard |
| PQ signatures | ML-DSA (FIPS 204) via `liboqs-python` | Finalized NIST standard |
| Crypto fallback | `kyber-py` + `dilithium-py` | Pure Python, zero compile step — demo-only, see warning below |
| Symmetric cipher | AES-256-GCM (`cryptography` package) | Standard, fast, authenticated |
| Ledger nodes | 3 lightweight FastAPI services + SQLite | No infra to provision, still genuinely distributed |
| Watermark | Zero-width Unicode steganography | Invisible, no external dependencies |

No cloud KMS, no external APIs, no public blockchain anywhere in this stack — every dependency runs entirely on local machines, and nothing here makes a network call outside your own processes.

---

## Step 0 — Crypto Pre-Flight (do this before anything else)

This is the single biggest risk to your timeline. Time-box it to 15 minutes.

1. Try `pip install liboqs-python` (or build `liboqs` from source if wheels aren't available for your platform).
2. Run a smoke test: generate an ML-KEM keypair, encapsulate/decapsulate, confirm the shared secrets match on both sides; generate an ML-DSA keypair, sign a message, verify it.
3. **Works cleanly** → use `liboqs-python` for everything below.
4. **Fights you** → `pip install kyber-py dilithium-py` and use those instead. They implement ML-KEM and ML-DSA in pure Python with no compile step.
   > ⚠️ Both packages explicitly warn they're educational — not constant-time, no side-channel hardening, "under no circumstances" for real cryptographic use. That's fine for proving the protocol logic in a demo. State this plainly when you present, and name `liboqs` (or a hardware-backed implementation) as what a production build would actually run.

Do not move on to Step 1 until this smoke test passes on one path or the other.

---

## Step 1 — Broadcast-Encrypt, Individually-Decrypt

**Setup (once, before any distribution):**
- Each recipient generates their own ML-KEM keypair locally and shares only the public key.
- Build a small **signed JSON keyring**: `{recipient_id: {kem_pubkey, sign_pubkey}}`, signed once with an "org root" key. This stands in for a real PKI/CA — see Step 3's hardening note for what replaces it later.

**Encryption (sender side):**
1. Generate a random AES-256 key `K`.
2. `ciphertext = AES-256-GCM.encrypt(K, document)` — one ciphertext, identical for every recipient.
3. For each recipient `i`: `(kem_ct_i, shared_secret_i) = ML-KEM.encapsulate(recipient_i.kem_pubkey)`; `wrap_key_i = HKDF(shared_secret_i)`; `wrapped_K_i = AES-KeyWrap(wrap_key_i, K)`.
4. Distribute the package: `{ciphertext, {recipient_id: {kem_ct_i, wrapped_K_i}}}`.

**Decryption (recipient side):**
1. `shared_secret_i = ML-KEM.decapsulate(recipient_i.kem_privkey, kem_ct_i)`.
2. `wrap_key_i = HKDF(shared_secret_i)`.
3. `K = AES-KeyUnwrap(wrap_key_i, wrapped_K_i)`.
4. `document = AES-256-GCM.decrypt(K, ciphertext)`.

**Checkpoint:** 2–3 recipients each decrypt independently with only their own private key; no one's key can unwrap anyone else's copy.

---

## Step 2 — Invisible Per-Session Watermark

**Payload:** a random 128-bit session token, generated fresh at every decryption — not the recipient's name. The token only resolves to an identity later, via the ledger. Repeat the encoded bitstream 3–5 times through the document and decode by majority vote, so minor damage doesn't destroy the whole payload.

**Embed** (zero-width Unicode, text/PDF-text-layer documents):
```python
ZW = {'0': '\u200b', '1': '\u200c'}  # zero-width space / non-joiner

def embed(text: str, bits: str) -> str:
    words = text.split(' ')
    for i, b in enumerate(bits):
        if i < len(words) - 1:
            words[i] += ZW[b]
    return ' '.join(words)
```

**Extract:**
```python
def extract(text: str, expected_len: int) -> str:
    bits = ''
    for ch in text:
        if ch == '\u200b':
            bits += '0'
        elif ch == '\u200c':
            bits += '1'
    return bits[:expected_len]
```

**Note for the demo:** the two decrypted copies render identically — but they're not byte-identical (a raw diff or file-size check will show a few extra characters). Mention this if anyone tries to diff the files directly.

**Checkpoint:** decrypt the same document for two recipients, confirm both render identically, run the extractor on each, confirm two different session tokens come out.

> **Production hardening:** add a pixel-domain layer for image-heavy or scanned documents using the open-source `invisible-watermark` package (`pip install invisible-watermark`, DWT-DCT method) on a rendered page image. It survives compression and reformatting far better than zero-width text, at the cost of more moving parts — add it once the core loop works, not before.

---

## Step 3 — Sign the Decryption Record

At the moment of decryption, the recipient's client builds a record and signs it:

```python
record = {
    "doc_hash": sha256(ciphertext).hexdigest(),
    "recipient_id": "alice",
    "watermark_session_id": session_token,
    "timestamp": utc_now_iso(),
}
signature = ML_DSA.sign(recipient_privkey, canonical_json(record))
```

Anyone verifying later looks up `recipient_id` in the signed JSON keyring from Step 1, takes `sign_pubkey`, and checks `ML_DSA.verify(sign_pubkey, canonical_json(record), signature)`.

**Checkpoint:** a correctly signed record verifies against the keyring; a record with even one byte changed fails verification.

> **Production hardening:** replace the JSON keyring with a real offline CA issuing certificates over ML-DSA public keys, and move private keys off general-purpose laptops onto hardware (smart card / TPM / HSM). A software key on a laptop weakens the non-repudiation claim — "malware signed it, not me" becomes a credible defense.

---

## Step 4 — Tamper-Evident Ledger (3-node hash chain, 2-of-3 quorum)

Run 3 identical lightweight services locally (ports `8001`/`8002`/`8003`), each with its own SQLite file. This is the centerpiece of "no single admin can rewrite history," and it's genuinely worth building rather than faking.

**Entry structure:**
```json
{
  "index": 42,
  "record": { "...": "..." },
  "recipient_signature": "base64(...)",
  "prev_hash": "sha256 of previous entry's entry_hash",
  "entry_hash": "sha256(index || record || recipient_signature || prev_hash)",
  "node_cosignatures": {"node1": "...", "node2": "...", "node3": "..."}
}
```

**Append protocol:**
1. The recipient's client proposes a new entry to all 3 nodes, with `prev_hash` set to what it believes is the current chain tip.
2. Each node checks the proposal's `prev_hash` against its own last `entry_hash`. If it matches, the node co-signs the proposal.
3. Once 2-of-3 co-signatures are collected, the entry is committed — each node appends it independently to its own local chain.
4. Periodically (or on lookup), any two nodes can be asked to compare their last N `entry_hash` values; a mismatch flags a diverged replica.

**Checkpoint / best demo moment:** kill one node process and confirm the system still commits new entries via the remaining 2-of-3 quorum. Then hand-edit a row in one node's SQLite file directly and re-run the chain verification — show it's immediately flagged as inconsistent with the other two replicas.

> **Production hardening:** run the 3+ nodes on genuinely separate machines under independent administrative control, and consider swapping the hand-rolled chain for **Hyperledger Fabric**, which gives the same guarantee through formal multi-org endorsement policies and has an official air-gapped deployment path. Don't attempt Fabric for the demo itself — its setup (CAs, ordering service, channels, chaincode) can consume the whole build window on its own.

---

## Step 5 — Leak-Trace Pipeline

Given a leaked file, this ties everything together:

1. **Extract** the watermark session token from the leaked document (Step 2, reversed).
2. **Look up** that token against the ledger replicas to retrieve the matching entry.
3. **Verify**, independently:
   - The recipient's ML-DSA signature over the record, using their public key from the keyring — confirms this recipient's key produced it.
   - The ledger's hash chain around that entry, and agreement across the 3 replicas — confirms the record wasn't altered or inserted after the fact.
   - The recorded `doc_hash` matches the leaked document's ciphertext hash — confirms this is the right document.
4. **Output** an attribution report bundling the recipient identity, timestamp, and all three verification results.

**Checkpoint:** run this end-to-end on a genuinely leaked (copied) test file and confirm it names the right recipient; run it on a document that was never distributed and confirm it reports "no match."

---

## Suggested Project Layout

```
project/
  crypto/
    kem.py          # ML-KEM wrappers (liboqs, falls back to kyber-py)
    sign.py         # ML-DSA wrappers (liboqs, falls back to dilithium-py)
    envelope.py     # hybrid encrypt/decrypt
  watermark/
    zw_embed.py
    zw_extract.py
  identity/
    keyring.py      # load/verify the signed JSON keyring
    setup_keys.py   # one-time key generation + registration
  ledger/
    node.py         # single ledger node service (FastAPI)
    chain.py        # hash-chain structure + cross-replica verification
    client.py       # propose/append helper used by the recipient's client
  cli/
    encrypt_doc.py
    decrypt_and_watermark.py
    leak_trace.py
  keys/              # generated demo keypairs — never ship these
  data/              # sample documents, ledger sqlite files
```

---

## Build & Demo Order

1. Crypto pre-flight — confirm before anything else.
2. Hybrid PQ encryption, one sender, 2–3 recipients.
3. Zero-width watermark embed/extract.
4. Sign + verify decryption records against the keyring.
5. 3-node ledger with 2-of-3 quorum signing.
6. Leak-trace CLI end to end.

**Suggested live demo narrative:** encrypt once → two recipients decrypt, show the outputs look identical → "leak" one recipient's copy → run the leak-trace CLI → it names the right recipient with a verified signature and ledger proof → kill a ledger node and hand-edit a replica to show the tamper-detection still catches it.

**Proving the air-gap claim:** develop with networking on as normal; right before the live run, disable Wi-Fi/networking and re-run the full pipeline to show it makes zero external calls at runtime.

---

## What to Say Out Loud When You Present

Be upfront about the two simplifications that trade rigor for speed, since a technical audience will ask:
- If you used the pure-Python crypto fallback (`kyber-py`/`dilithium-py`), name it and say `liboqs` (or hardware-backed keys) is the production path.
- The JSON keyring stands in for a real PKI; a real deployment would use an offline CA and hardware-backed private keys for genuine non-repudiation.

Everything else — the hybrid encryption, the watermark design, the ledger's hash-chain and quorum logic, the verification pipeline — is the real mechanism, just running on a laptop instead of separate hardened infrastructure.