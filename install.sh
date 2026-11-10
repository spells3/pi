#!/usr/bin/env bash
set -euo pipefail

DOTFILES_PI="$(cd "$(dirname "$0")" && pwd)"

# Bootstrap ignored working files without overwriting local configuration.
for name in settings models; do
    config="$DOTFILES_PI/$name.json"
    template="$DOTFILES_PI/$name.example.json"
    if [[ ! -e "$config" && ! -L "$config" ]]; then
        cp "$template" "$config"
        chmod 600 "$config"
        echo "Created $name.json from template."
    fi
    agent_config="$HOME/.pi/agent/$name.json"
    if [[ -e "$agent_config" || -L "$agent_config" ]] && ! cmp -s "$config" "$agent_config"; then
        echo "Config conflict: $agent_config differs from $config. Reconcile them before installing." >&2
        exit 1
    fi
    echo "Configuration diff: $name (template -> local; credentials redacted)"
    node "$DOTFILES_PI/scripts/config-diff.mjs" "$template" "$config"
done

mkdir -p ~/.pi/agent/extensions

# Symlink local config files and shared extensions.
ln -sf "$DOTFILES_PI/settings.json"                        ~/.pi/agent/settings.json
ln -sf "$DOTFILES_PI/models.json"                          ~/.pi/agent/models.json
ln -sf "$DOTFILES_PI/extensions/behavior-guardrails.ts"    ~/.pi/agent/extensions/behavior-guardrails.ts
ln -sf  "$DOTFILES_PI/extensions/rtk.ts"                  ~/.pi/agent/extensions/rtk.ts
ln -sfn "$DOTFILES_PI/extensions/save-plan-dir"           ~/.pi/agent/extensions/save-plan-dir

echo "Symlinks created."

# The template is the single source of portable package declarations.
PACKAGES="$(node -p 'require(process.argv[1]).packages.join("\n")' "$DOTFILES_PI/settings.example.json")"
while IFS= read -r pkg; do
    [[ -n "$pkg" ]] || continue
    echo "Installing $pkg..."
    pi install "$pkg"
done <<< "$PACKAGES"

# Install standalone skills into ~/.agents/skills
echo "Installing unslop skill..."
npx -y skills add https://github.com/cursor/plugins --skill unslop -g -a pi -y

echo "Done."
