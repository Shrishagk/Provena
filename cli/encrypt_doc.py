from __future__ import annotations
import argparse
from pathlib import Path
from crypto.envelope import encrypt_document, save_envelope
from identity.keyring import load_root_public_key, load_verified_keyring, unb64


def main() -> None:
    parser = argparse.ArgumentParser(description="Encrypt a text document once for many ML-KEM recipients")
    parser.add_argument("source")
    parser.add_argument("--output", required=True)
    parser.add_argument("--keyring", default="keys/keyring.json")
    parser.add_argument("--root-public-key", help="separately pinned organization root public key")
    args = parser.parse_args()
    keyring_path = Path(args.keyring)
    root_path = Path(args.root_public_key) if args.root_public_key else keyring_path.with_name("org_root_public.json")
    keyring = load_verified_keyring(keyring_path, load_root_public_key(root_path))
    recipients = {name: unb64(item["kem_public_key"]) for name, item in keyring["recipients"].items()}
    envelope = encrypt_document(Path(args.source).read_bytes(), recipients)
    save_envelope(envelope, args.output)
    print(f"Encrypted once for {len(recipients)} recipients. Ciphertext SHA-256: {envelope['ciphertext_sha256']}")


if __name__ == "__main__": main()
