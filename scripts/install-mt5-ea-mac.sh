#!/bin/bash
# Copy Vyronis EA into Wine MT5 (Mac). Run: bash scripts/install-mt5-ea-mac.sh
set -e
MT5_BASE="$HOME/Library/Application Support/net.metaquotes.wine.metatrader5/drive_c/Program Files/MetaTrader 5/MQL5"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ ! -d "$MT5_BASE" ]; then
  echo "MT5 folder not found. Open MT5 once, then retry."
  exit 1
fi
mkdir -p "$MT5_BASE/Experts" "$MT5_BASE/Include"
cp "$ROOT/mt5/experts/VyronisTradeSync.mq5" "$MT5_BASE/Experts/"
cp "$ROOT/mt5/include/VyronisTradeWebhook.mqh" "$MT5_BASE/Include/"
echo "Installed:"
echo "  $MT5_BASE/Experts/VyronisTradeSync.mq5"
echo "  $MT5_BASE/Include/VyronisTradeWebhook.mqh"
echo "Next: MetaEditor → open Experts/VyronisTradeSync.mq5 → Compile (F7)"
