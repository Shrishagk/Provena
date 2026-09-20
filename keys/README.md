# Generated key material

This directory contains runtime-generated public registries only. Do not
commit key material. Run `python -m identity.setup_keys` to generate a fresh
local demo trust domain.

Recipient, organization-root, and node private keys must be generated outside
this repository with `--recipient-key-dir`, `--root-key-dir`, and
`--node-key-dir`; the gateway needs only the signed public registries and its
pinned root public key.
