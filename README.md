# Offline Post-Quantum Forensic Watermarking Prototype

This is a deliberately small, runnable implementation of the workflow in
`Implenatation_steps.md`. It encrypts one UTF-8 text file for multiple
recipients, creates an invisible 128-bit watermark during each decryption,
has the recipient sign a canonical decryption record with ML-DSA-65, and
commits it to three locally hosted, quorum-cosigned SQLite ledgers.

No service makes an external network call at runtime. The ledger uses only
loopback addresses by default, and those URLs can be replaced with private
air-gapped LAN node addresses.

## Important prototype boundary

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

To show quorum availability, stop one node and repeat a decryption: the two
remaining nodes still commit. To inspect the replicas, run:

```powershell
python -m cli.verify_ledger
```

Do not commit `keys/*.private.json`, generated encrypted packages, decrypted
copies, or `data/*.sqlite3`. In deployment, create recipient private keys on
their own devices and replace the signed JSON keyring with an offline CA and
hardware-backed keys.
