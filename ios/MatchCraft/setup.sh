#!/usr/bin/env bash
# Generates the Xcode project from project.yml using XcodeGen.
# Run once after cloning, and again whenever project.yml changes.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if ! command -v xcodegen &>/dev/null; then
  echo "XcodeGen not found. Installing via Homebrew…"
  if ! command -v brew &>/dev/null; then
    echo "Error: Homebrew is required. Install it from https://brew.sh and re-run this script."
    exit 1
  fi
  brew install xcodegen
fi

echo "Generating Xcode project…"
cd "$SCRIPT_DIR"
xcodegen generate

echo ""
echo "Done! Open MatchCraft.xcodeproj in Xcode."
echo ""
echo "Before building:"
echo "  1. Open project settings → Signing & Capabilities"
echo "  2. Set your Team ID for both the MatchCraft and MatchCraftKeyboard targets"
echo "  3. Update WORKER_BASE_URL in MatchCraftKeyboard/APIClient.swift"
echo ""
echo "To run in the simulator:"
echo "  xcodebuild -scheme MatchCraft -destination 'platform=iOS Simulator,name=iPhone 16' build"
