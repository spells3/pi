/**
 * Pure helpers for the save-plan-dir extension. No pi imports so they can be
 * tested with `node --test`.
 */
import { homedir } from "node:os";
import { basename, extname, isAbsolute, join, relative, resolve, sep } from "node:path";

/** Plan locations relative to the project root. A trailing "/" means prefix match, otherwise exact match. */
export const DEFAULT_PLAN_PREFIXES: string[] = ["docs/superpowers/", "docs/plans/", "docs/specs/", "PLAN.md"];

const PLANS_HEADING = "## Plans";

export function planDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.PI_SAVE_PLAN_DIR || join(homedir(), "obsidian", "strage", "raw");
}

export function planPrefixes(env: NodeJS.ProcessEnv = process.env): string[] {
  const extra = (env.PI_SAVE_PLAN_PATTERNS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...DEFAULT_PLAN_PREFIXES, ...extra];
}

export function isPlanPath(path: string, cwd: string, prefixes: string[] = DEFAULT_PLAN_PREFIXES): boolean {
  const rel = relative(cwd, resolve(cwd, path));
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) return false;
  const norm = rel.split(sep).join("/");
  return prefixes.some((p) => (p.endsWith("/") ? norm.startsWith(p) : norm === p));
}

export function targetPathFor(path: string, cwd: string, dir: string): string {
  const name = basename(path);
  const file = extname(name) ? name : `${name}.md`;
  return join(dir, `${basename(cwd)}--${file}`);
}

/** Returns updated AGENTS.md content, or null when the link is already present. */
export function appendPlanLink(content: string | null, target: string): string | null {
  const line = `- [${basename(target)}](${target})`;
  if (content === null) return `# Agent notes\n\n${PLANS_HEADING}\n\n${line}\n`;
  if (content.includes(line)) return null;

  const lines = content.split("\n");
  const start = lines.indexOf(PLANS_HEADING);
  if (start === -1) {
    const sep = content.endsWith("\n") ? "\n" : "\n\n";
    return `${content}${sep}${PLANS_HEADING}\n\n${line}\n`;
  }

  // Section ends at the next heading or EOF; insert after the last non-empty line of the section.
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      end = i;
      break;
    }
  }
  let insertAt = end;
  while (insertAt > start + 1 && lines[insertAt - 1].trim() === "") insertAt--;
  lines.splice(insertAt, 0, line);
  return lines.join("\n");
}
