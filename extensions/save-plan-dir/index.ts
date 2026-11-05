/**
 * save-plan-dir Extension
 *
 * Skills and other extensions like to write plans/specs into the project tree
 * (docs/superpowers/plans, docs/plans, docs/specs, PLAN.md). This extension
 * silently redirects read/write/edit of those paths to one notes directory:
 *
 *   $PI_SAVE_PLAN_DIR (default: $HOME/obsidian/strage/raw)
 *
 * Files are stored flat as `<project>--<basename>` (`.md` added when the name
 * has no extension). Extra plan locations: PI_SAVE_PLAN_PATTERNS="notes/,TODO.md".
 *
 * After each successful write, a link is appended to `<cwd>/AGENTS.md` under
 * a `## Plans` section so the agent can find the plan later.
 *
 * Place: ~/.pi/agent/extensions/save-plan-dir/ (symlinked from dotfiles).
 * Reload after edits with /reload.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type ExtensionAPI, isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { appendPlanLink, isPlanPath, planDir, planPrefixes, targetPathFor } from "./paths.ts";

const PATH_TOOLS = ["read", "write", "edit"] as const;

export default function (pi: ExtensionAPI) {
  const redirectedWrites = new Set<string>();

  pi.on("tool_call", async (event, ctx) => {
    for (const tool of PATH_TOOLS) {
      if (!isToolCallEventType(tool, event)) continue;
      const input = event.input as { path: string };
      if (!isPlanPath(input.path, ctx.cwd, planPrefixes())) return;

      const target = targetPathFor(input.path, ctx.cwd, planDir());
      if (tool === "write") {
        mkdirSync(dirname(target), { recursive: true });
        redirectedWrites.add(event.toolCallId);
      }
      input.path = target;
      if (ctx.hasUI) ctx.ui.notify(`Plan redirected: ${target}`, "info");
      return;
    }
  });

  pi.on("tool_result", async (event, ctx) => {
    if (!redirectedWrites.delete(event.toolCallId) || event.isError) return;
    const target = (event.input as { path: string }).path;
    const agentsMd = join(ctx.cwd, "AGENTS.md");
    const current = existsSync(agentsMd) ? readFileSync(agentsMd, "utf8") : null;
    const updated = appendPlanLink(current, target);
    if (updated !== null) writeFileSync(agentsMd, updated, "utf8");
  });

  pi.on("before_agent_start", async (event) => {
    const note = `

## Plan storage

Plan and spec files under ${planPrefixes().join(", ")} are redirected automatically to ${planDir()} as \`<project>--<name>\` (markdown by default). Keep using those project-relative paths when writing or reading; when reporting to the user, name the real path from the tool result. An index of saved plans lives in the project's AGENTS.md under "## Plans".
`;
    return { systemPrompt: event.systemPrompt + note };
  });
}
