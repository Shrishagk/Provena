# Creates a fresh, internally consistent CLI demo. Run from the repository root.
# This intentionally replaces locally generated keys, ledger databases, and demo artifacts.
param(
    [string]$RecipientKeyDir = (Join-Path $env:LOCALAPPDATA 'PQForensicDemo\recipient-vault'),
    [string]$RootKeyDir = (Join-Path $env:LOCALAPPDATA 'PQForensicDemo\org-root'),
    [string]$NodeKeyDir = (Join-Path $env:LOCALAPPDATA 'PQForensicDemo\single-host-node-vault')
)

$ErrorActionPreference = 'Stop'

python -m identity.setup_keys --recipient-key-dir $RecipientKeyDir --root-key-dir $RootKeyDir --node-key-dir $NodeKeyDir
if ($LASTEXITCODE -ne 0) { throw 'Identity setup failed; ledger nodes were not started.' }
& "$PSScriptRoot\start_ledger_nodes.ps1"
python -m cli.encrypt_doc "$PSScriptRoot\data\sample_document.txt" --output "$PSScriptRoot\data\briefing.pqe.json"
if ($LASTEXITCODE -ne 0) { throw 'Document encryption failed; stopping the demo.' }
python -m cli.decrypt_and_watermark "$PSScriptRoot\data\briefing.pqe.json" --recipient alice --key-dir $RecipientKeyDir --output "$PSScriptRoot\data\alice_copy.txt"
if ($LASTEXITCODE -ne 0) { throw 'Alice decryption failed; stopping the demo.' }
python -m cli.decrypt_and_watermark "$PSScriptRoot\data\briefing.pqe.json" --recipient bob --key-dir $RecipientKeyDir --output "$PSScriptRoot\data\bob_copy.txt"
if ($LASTEXITCODE -ne 0) { throw 'Bob decryption failed; stopping the demo.' }
python -m cli.leak_trace "$PSScriptRoot\data\bob_copy.txt" --envelope "$PSScriptRoot\data\briefing.pqe.json"
if ($LASTEXITCODE -ne 0) { throw 'Leak tracing failed; stopping the demo.' }
Write-Output "Recipient private keys were generated in $RecipientKeyDir. Keep this directory off the gateway."
Write-Output "The organization root private key was generated in $RootKeyDir. Keep this directory offline."
Write-Output "The local demo's node private keys were generated in $NodeKeyDir. Production requires one independently controlled vault per node."
