# Run this from the repository root after `python -m identity.setup_keys`.
# Re-running setup regenerates all signing keys, so replace any node already
# listening on one of the dedicated local ledger ports.
$ErrorActionPreference = 'Stop'

function Stop-ExistingLedgerNode([int]$Port, [string]$NodeId) {
    try {
        $health = Invoke-RestMethod "http://127.0.0.1:$Port/health" -TimeoutSec 1
    } catch {
        return
    }
    if ($health.node_id -ne $NodeId) {
        throw "Port $Port is occupied by a service that is not ledger $NodeId. Stop it before starting the ledger."
    }

    $line = netstat -ano -p TCP | Select-String "127.0.0.1:$Port\s+.*LISTENING\s+\d+\s*$" | Select-Object -First 1
    if (-not $line -or $line.Line -notmatch "\s(\d+)\s*$") {
        throw "Could not determine the process listening on ledger port $Port."
    }
    $listenerProcessId = [int]$Matches[1]
    Stop-Process -Id $listenerProcessId -Force
    Start-Sleep -Milliseconds 250
}

function Start-LedgerNode([int]$Port, [string]$NodeId) {
    Start-Process python -ArgumentList "-m ledger.node --node $NodeId --port $Port" -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
    foreach ($attempt in 1..20) {
        Start-Sleep -Milliseconds 250
        try {
            $health = Invoke-RestMethod "http://127.0.0.1:$Port/health" -TimeoutSec 1
            if ($health.node_id -eq $NodeId) { return }
        } catch {}
    }
    throw "Ledger $NodeId did not become healthy on port $Port."
}

Stop-ExistingLedgerNode 8001 'node1'
Stop-ExistingLedgerNode 8002 'node2'
Stop-ExistingLedgerNode 8003 'node3'

$resetMarker = Join-Path $PSScriptRoot 'data\ledger-reset-required'
if (Test-Path -LiteralPath $resetMarker) {
    foreach ($nodeId in 'node1', 'node2', 'node3') {
        foreach ($suffix in '.sqlite3', '.sqlite3-wal', '.sqlite3-shm') {
            $database = Join-Path $PSScriptRoot "data\$nodeId$suffix"
            Remove-Item -LiteralPath $database -Force -ErrorAction SilentlyContinue
        }
    }
    Remove-Item -LiteralPath $resetMarker -Force
}

Start-LedgerNode 8001 'node1'
Start-LedgerNode 8002 'node2'
Start-LedgerNode 8003 'node3'
Write-Output 'Started and verified local ledger nodes at ports 8001, 8002, and 8003.'
