/**
 * Behavior Guardrails Extension
 *
 * Enforces three rules across all sessions:
 *   1. Reply in the language the current prompt is written in.
 *   2. Write only English to disk (code, comments, identifiers, docs, commit
 *      messages, file contents) regardless of the conversation language.
 *   3. Never emit emojis.
 *
 * All three are LLM behavioral instructions, so a single system-prompt
 * append via before_agent_start is the minimal mechanism that covers them.
 *
 * Place: ~/.pi/agent/extensions/ (global) or .pi/extensions/ (project-local).
 * Reload after edits with /reload.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const GUARDRAILS = `

## Behavior Guardrails (non-negotiable)

- **Match the prompt's language.** Reply in the language the user's current message is written in. If they switch language, switch with them. Code-like tokens and identifiers stay as-is.
- **English on disk only.** Anything you persist to a file — code, comments, identifiers, documentation, commit messages, config, file contents — must be in English, no matter what language the conversation is in. Your replies to the user may be in their language; what you write to disk must always be English.
- **No emojis.** Never use emoji, in any language, anywhere — replies, files, commit messages, UI text. None.
`;

export default function (pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event) => {
    return { systemPrompt: event.systemPrompt + GUARDRAILS };
  });
}
