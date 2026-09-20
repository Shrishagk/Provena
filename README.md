# Offline Post-Quantum Forensic Watermarking Prototype

This is a deliberately small, runnable implementation of the workflow in
`Implenatation_steps.md`. It encrypts one UTF-8 text file for multiple
recipients, creates an invisible 128-bit watermark during each decryption,
has the recipient-side workflow sign a canonical decryption record with
ML-DSA-65, and commits it to three locally hosted, quorum-cosigned SQLite
ledgers.

No service makes an external network call at runtime. The ledger uses only
loopback addresses by default, and those URLs can be replaced with private
air-gapped LAN node addresses.

## Important prototype boundary

The browser control plane is explicitly **gateway-custody demo mode**: its
decryption endpoint reads recipient private keys from the gateway filesystem.
Its signatures prove that the gateway-held key signed a record, not that the
named recipient personally performed the action. Do not use browser-mode
verification as non-repudiation evidence.

The default ledger nodes are three separate FastAPI processes with separate
SQLite files and signing keys, all on one host and under one administrator.
Their 2-of-3 rule detects divergence and tolerates one unavailable process;
it does not defend against that host administrator. They must be deployed on
separate machines under independently controlled administrative domains before
claiming that protection.

The normal preferred backend is `liboqs-python`. The included fallback,
`kyber-py`/`dilithium-py`, implements FIPS 203 ML-KEM-768 and FIPS 204
ML-DSA-65 but explicitly is educational, not constant-time software. Do not
use it in production. The zero-width watermark is intended for text documents;
it will not survive format conversion, printing, OCR, or aggressive editing.

## Demo

Install the requirements into a Python virtual environment (or use the
project-local `.deps` bundle created for this workspace), then execute:

```powershell
python -m identity.setup_keys
.\start_ledger_nodes.ps1
python -m cli.encrypt_doc data\sample_document.txt --output data\briefing.pqe.json
python -m cli.decrypt_and_watermark data\briefing.pqe.json --recipient alice --output data\alice_copy.txt
python -m cli.decrypt_and_watermark data\briefing.pqe.json --recipient bob --output data\bob_copy.txt
python -m cli.leak_trace data\bob_copy.txt --envelope data\briefing.pqe.json
```

The final command reports Bob, validates the signed keyring, validates Bob's
ML-DSA-65 record signature, verifies its binding to the encrypted package, and
requires two agreeing valid ledger chains. `alice_copy.txt` and `bob_copy.txt`
render identically even though their invisible trailing characters differ.

`setup_keys` deliberately starts a fresh demo trust domain: it regenerates
the keys and clears the three generated ledger databases. The node-start script
then replaces any existing local ledger processes on its dedicated ports, so it
is safe to rerun the full demo sequence without stale node keys.

To show quorum availability, stop one node and repeat a decryption: the two
remaining nodes still commit. To inspect the replicas, run:

```powershell
python -m cli.verify_ledger
```

Do not commit `keys/*.private.json`, generated encrypted packages, decrypted
copies, or `data/*.sqlite3`. For a recipient-controlled workflow, generate
keys outside the gateway directory and run decryption/signing on the recipient
device:

```powershell
python -m identity.setup_keys --recipient-key-dir C:\recipient-vault
.\start_ledger_nodes.ps1
python -m cli.encrypt_doc data\sample_document.txt --output data\briefing.pqe.json
python -m cli.decrypt_and_watermark data\briefing.pqe.json --recipient alice --key-dir C:\recipient-vault --output C:\recipient-output\alice_copy.txt
```

The gateway will intentionally be unable to perform browser-mode decryption
when those private keys are outside its filesystem. In deployment, use a real
offline CA and recipient-controlled hardware-backed keys.

## Web control plane

`forensic-watermarking-system-frontend` is connected to the local FastAPI
gateway at `http://127.0.0.1:8080`. Start the ledger replicas first, then the
gateway and Next.js application in separate terminals:

```powershell
.\start_ledger_nodes.ps1
python -m api.server
cd forensic-watermarking-system-frontend
Copy-Item .env.local.example .env.local
corepack pnpm dev
```

Open `http://localhost:3000`. The UI reads live recipients and ledger state,
submits multipart uploads to the gateway, and downloads generated artifacts
through its local endpoint. It contains no cloud analytics. The overview and
ledger pages both use the same live status endpoint; neither has a fallback
ledger height or tip.

For an air-gapped LAN deployment, host the gateway inside the private network,
set `NEXT_PUBLIC_API_BASE_URL` and `CORS_ORIGINS` to its private address, and
set `FORENSIC_LEDGER_NODES` to the three replica URLs. Binding a node to a LAN
interface requires `python -m ledger.node --node node1 --port 8001 --host
<private-address>`; independently administered deployments also require
separate host/key provisioning and network authentication, not just different
URLs.
