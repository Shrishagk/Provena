"""ML-KEM-768 and ML-DSA-65 adapters.

Prefer liboqs-python when it is installed.  The bundled demo fallback is
kyber-py/dilithium-py, which implements the NIST algorithms but is educational
software and must be replaced with a vetted provider for production.
"""
from __future__ import annotations
from localdeps import ensure_local_dependencies
ensure_local_dependencies()

try:  # liboqs API varies across releases, so retain a self-contained fallback.
    import oqs  # type: ignore
except ImportError:
    oqs = None

if oqs is None:
    from kyber_py.ml_kem import ML_KEM_768
    from dilithium_py.ml_dsa import ML_DSA_65
    BACKEND = "kyber-py/dilithium-py (educational fallback)"
else:
    BACKEND = "liboqs-python"


def kem_keygen() -> tuple[bytes, bytes]:
    if oqs is None:
        return ML_KEM_768.keygen()
    with oqs.KeyEncapsulation("ML-KEM-768") as kem:
        public_key = kem.generate_keypair()
        return public_key, kem.export_secret_key()


def kem_encapsulate(public_key: bytes) -> tuple[bytes, bytes]:
    if oqs is None:
        # kyber-py returns (shared_secret, ciphertext); keep this adapter's
        # public contract as (ciphertext, shared_secret), matching liboqs.
        secret, ciphertext = ML_KEM_768.encaps(public_key)
        return ciphertext, secret
    with oqs.KeyEncapsulation("ML-KEM-768") as kem:
        ciphertext, secret = kem.encap_secret(public_key)
        return ciphertext, secret


def kem_decapsulate(secret_key: bytes, ciphertext: bytes) -> bytes:
    if oqs is None:
        return ML_KEM_768.decaps(secret_key, ciphertext)
    with oqs.KeyEncapsulation("ML-KEM-768", secret_key) as kem:
        return kem.decap_secret(ciphertext)


def sign_keygen() -> tuple[bytes, bytes]:
    if oqs is None:
        return ML_DSA_65.keygen()
    with oqs.Signature("ML-DSA-65") as signer:
        public_key = signer.generate_keypair()
        return public_key, signer.export_secret_key()


def sign(secret_key: bytes, message: bytes) -> bytes:
    if oqs is None:
        return ML_DSA_65.sign(secret_key, message)
    with oqs.Signature("ML-DSA-65", secret_key) as signer:
        return signer.sign(message)


def verify(public_key: bytes, message: bytes, signature: bytes) -> bool:
    try:
        if oqs is None:
            return ML_DSA_65.verify(public_key, message, signature)
        with oqs.Signature("ML-DSA-65") as signer:
            return signer.verify(message, signature, public_key)
    except Exception:
        return False
