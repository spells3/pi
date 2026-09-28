#!/usr/bin/env bash
set -euo pipefail

DOTFILES_PI="$(cd "$(dirname "$0")" && pwd)"

mkdir -p ~/.pi/agent/extensions

# Symlink config files
ln -sf "$DOTFILES_PI/settings.json"                        ~/.pi/agent/settings.json
ln -sf "$DOTFILES_PI/models.json"                          ~/.pi/agent/models.json
ln -sf "$DOTFILES_PI/extensions/behavior-guardrails.ts"    ~/.pi/agent/extensions/behavior-guardrails.ts

echo "Symlinks created."

# Install pi packages (local paths skipped — machine-specific)
PACKAGES=(
    "git:github.com/DietrichGebert/ponytail"
    "git:github.com/obra/superpowers"
    "npm:pi-zentui"
    "npm:@micka33/pi-karpathy-skill"
    "npm:@upstash/context7-pi"
)

for pkg in "${PACKAGES[@]}"; do
    echo "Installing $pkg..."
    pi install "$pkg"
done

echo "Done."
