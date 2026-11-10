import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [
    key,
    ["apiKey", "headers", "httpProxy"].includes(key) ? "<redacted>" : normalize(value[key]),
  ]));
}

let temp;
try {
  const paths = process.argv.slice(2);
  if (paths.length !== 2) throw new Error("Expected template and local paths");
  const configs = paths.map((path) => JSON.stringify(normalize(JSON.parse(readFileSync(path, "utf8"))), null, 2) + "\n");
  temp = mkdtempSync(join(tmpdir(), "pi-config-diff-"));
  const files = [join(temp, "template.json"), join(temp, "local.json")];
  configs.forEach((config, index) => writeFileSync(files[index], config, { mode: 0o600 }));
  const result = spawnSync("diff", ["-u", "--label", paths[0], "--label", paths[1], ...files], { stdio: "inherit" });
  if (result.error || (result.status !== 0 && result.status !== 1)) {
    throw new Error("Diff failed");
  }
} catch {
  console.error("Cannot compare configurations: check JSON files and the diff command.");
  process.exitCode = 1;
} finally {
  if (temp) rmSync(temp, { recursive: true, force: true });
}
