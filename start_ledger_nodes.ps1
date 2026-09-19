# Run this from the repository root after `python -m identity.setup_keys`.
$ErrorActionPreference = 'Stop'
Start-Process python -ArgumentList '-m ledger.node --node node1 --port 8001' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
Start-Process python -ArgumentList '-m ledger.node --node node2 --port 8002' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
Start-Process python -ArgumentList '-m ledger.node --node node3 --port 8003' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
Write-Output 'Started local ledger nodes at ports 8001, 8002, and 8003.'
