# Offline Post-Quantum Forensic Watermarking Prototype

This is a deliberately small, runnable implementation of the workflow in
`Implenatation_steps.md`. It encrypts one UTF-8 text file for multiple
recipients, creates an invisible 128-bit watermark during each decryption,
has the recipient-side workflow sign a canonical decryption record with
ML-DSA-65, and commits it to quorum-cosigned SQLite ledger replicas.

No service makes an external network call at runtime. The ledger uses only
loopback addresses by default, and those URLs can be replaced with private
air-gapped LAN node addresses.

## Important prototype boundary

The gateway never loads recipient private keys. CLI decryption uses a
recipient-controlled key directory; the browser workflow calls a
recipient-local agent bound to loopback. A valid ML-DSA signature proves that
the holder's key made the record. Hardware-backed keys, user authentication,
and an offline CA are still required for a legal non-repudiation claim.

`start_ledger_nodes.ps1` is a deliberately insecure availability demo: all
three processes, databases, and keys are on one host. It explicitly enables
`--allow-single-administrator-demo`, and the health/status response marks this
state. Outside that flag, nodes reject commits unless two valid co-signatures
come from distinct administrator domains in the root-signed node registry.
That check prevents a single configured operator from satisfying quorum in the
software; actual history protection still requires separate machines, separate
operator accounts, and keys that only those operators control.

Recipient and node registries are verified against a separately pinned
`org_root_public.json`; the keyring cannot select its own trust anchor. Pin a
copy of that public key on every verifier/node (or give its path through
`FORENSIC_ROOT_PUBLIC_KEY_PATH` / `--root-public-key-path`). Keep the matching
root private key offline.

The normal preferred backend is `liboqs-python`. The included fallback,
`kyber-py`/`dilithium-py`, implements FIPS 203 ML-KEM-768 and FIPS 204
ML-DSA-65 but explicitly is educational, not constant-time software. Do not
use it in production. The zero-width watermark is intended for text documents;
it will not survive format conversion, printing, OCR, or aggressive editing.

## Demo

Install the requirements into a Python virtual environment (or use the
project-local `.deps` bundle created for this workspace), then execute:

```powershell
.\run_demo.ps1
```

The script defaults to user-local recipient, offline issuer, and explicitly
single-host-demo node vaults outside the repository. To use controlled
removable or secured locations, pass `-RecipientKeyDir <path>`,
`-RootKeyDir <path>`, and `-NodeKeyDir <path>`.

The final command reports Bob, validates the signed keyring, validates Bob's
ML-DSA-65 record signature, verifies its binding to the encrypted package, and
requires two agreeing valid ledger chains. `alice_copy.txt` and `bob_copy.txt`
render identically even though their invisible trailing characters differ.

`run_demo.ps1` deliberately starts a fresh demo trust domain: it regenerates
the keys and clears the three generated ledger databases. The node-start script
then replaces any existing local ledger processes on its dedicated ports, so it
is safe to rerun the full demo sequence without stale node keys.

To show quorum availability, stop one node and repeat a decryption: the two
remaining nodes still commit. To inspect the replicas, run:

```powershell
python -m cli.verify_ledger
```

Do not commit generated keys, encrypted packages, decrypted copies, or
`data/*.sqlite3`. The repository deliberately contains no pre-generated demo
outputs; use `run_demo.ps1` to avoid stale watermark/ledger fixtures. For a
recipient-controlled workflow, generate keys outside the gateway directory and
run decryption/signing on the recipient device:

```powershell
python -m identity.setup_keys --recipient-key-dir C:\recipient-vault --root-key-dir C:\offline-issuer-vault --node-key-dir C:\demo-node-vault
.\start_ledger_nodes.ps1
python -m cli.encrypt_doc data\sample_document.txt --output data\briefing.pqe.json
python -m cli.decrypt_and_watermark data\briefing.pqe.json --recipient alice --key-dir C:\recipient-vault --output C:\recipient-output\alice_copy.txt
```

`setup_keys` records the selected **local demo** node vault so the next
`start_ledger_nodes.ps1` uses the matching private node keys. To use a vault
without rerunning setup, pass `-NodeKeyDir C:\demo-node-vault` (or set
`FORENSIC_NODE_KEY_DIR`); the explicit argument takes precedence.

The gateway cannot decrypt this package because it has no recipient private-key
endpoint. In deployment, use a real offline CA and recipient-controlled
hardware-backed keys.

## Web control plane

`forensic-watermarking-system-frontend` talks to the local FastAPI gateway at
`http://127.0.0.1:8080` for encryption, tracing, and key discovery. Its
decryption request goes directly to a recipient-local agent at
`http://127.0.0.1:8081`. Start the ledger replicas, gateway, recipient agent,
and Next.js application in separate terminals:

```powershell
.\start_ledger_nodes.ps1
python -m api.server
python -m api.recipient_agent --recipient alice --key-dir C:\recipient-vault
cd forensic-watermarking-system-frontend
Copy-Item .env.local.example .env.local
corepack pnpm dev
```

Open `http://localhost:3000` on Alice's device. The UI reads live recipients
and ledger state from the gateway, but sends the encrypted package directly to
Alice's loopback agent; the output remains in Alice's local artifact directory.
It contains no cloud analytics. The overview and ledger pages both use the same
live status endpoint; neither has a fallback ledger height or tip.

For an air-gapped LAN deployment, host the gateway inside the private network,
set `NEXT_PUBLIC_API_BASE_URL` and `CORS_ORIGINS` to its private address, set
`NEXT_PUBLIC_RECIPIENT_AGENT_BASE_URL` to the recipient's protected local
agent address, and set `FORENSIC_LEDGER_NODES` to the three replica URLs.
Binding a node to a LAN interface requires `python -m ledger.node --node node1
--port 8001 --host <private-address>`; independently administered deployments
also require separate host/key provisioning and network authentication, not
just different URLs.

## Independently administered ledger deployment

Do not run `start_ledger_nodes.ps1` for an evidence-bearing deployment. The
setup command keeps the demo node keys out of the repository, but it still
places all three in one demo vault. Give each production operator only its own
`nodeN.private.json`, its own local database path, the same read-only signed
registries, and a separately pinned root public key.
Start each replica on its own protected host, for example:

```powershell
python -m ledger.node --node node1 --port 8001 --host <node1-private-address> `
  --node-key-path <node1-private-key> --database-path <node1-ledger-db> `
  --node-registry-path <signed-node-registry> --recipient-keyring-path <signed-recipient-keyring> `
  --root-public-key-path <pinned-root-public-key>
```

The signed node registry must give at least two nodes different
`administrator_domain` values. Generate each production node key on its own
host/HSM and have the offline root sign its public registry; never distribute
all node private keys to a gateway or one shared host. The software validates
the signed domains, but operational independence is something deployment
controls—not a property software can prove from IP addresses.
