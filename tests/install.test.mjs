import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function fixture(t) {
  const temp = mkdtempSync(join(tmpdir(), "pi-config-test-"));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const repo = join(temp, "repo with spaces");
  const home = join(temp, "home with spaces");
  const bin = join(temp, "bin");
  for (const dir of [repo, home, bin]) mkdirSync(dir);
  cpSync(join(root, "install.sh"), join(repo, "install.sh"));
  if (existsSync(join(root, "scripts"))) cpSync(join(root, "scripts"), join(repo, "scripts"), { recursive: true });
  writeFileSync(join(repo, "settings.example.json"), '{"theme":"dark","packages":["npm:portable-test"]}\n');
  writeFileSync(join(repo, "models.example.json"), '{"providers":{}}\n');
  for (const command of ["pi", "npx"]) {
    writeFileSync(join(bin, command), '#!/bin/bash\nprintf "%s\\n" "$*" >> "$HOME/commands.log"\n', { mode: 0o755 });
  }
  const run = () => spawnSync("bash", [join(repo, "install.sh")], {
    env: { ...process.env, HOME: home, PATH: `${bin}:${process.env.PATH}` },
    encoding: "utf8",
  });
  return { repo, home, run };
}

function succeeded(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test("fresh installation bootstraps configs and installs the template package list", (t) => {
  const { repo, home, run } = fixture(t);
  succeeded(run());
  for (const name of ["settings", "models"]) {
    assert.equal(readFileSync(join(repo, `${name}.json`), "utf8"), readFileSync(join(repo, `${name}.example.json`), "utf8"));
    assert.equal(readlinkSync(join(home, ".pi/agent", `${name}.json`)), join(repo, `${name}.json`));
  }
  const commands = readFileSync(join(home, "commands.log"), "utf8");
  assert.match(commands, /^install npm:portable-test$/m);
  assert.doesNotMatch(commands, /DietrichGebert/);
});

test("repeated installation preserves local files and reports informational differences", (t) => {
  const { repo, run } = fixture(t);
  const settings = '{"theme":"light","deviceId":"local-device","packages":[]}\n';
  const models = '{"providers":{"local":{"baseUrl":"http://localhost:6655","apiKey":"private-key","headers":{"Authorization":"private-header"}}}}\n';
  writeFileSync(join(repo, "settings.json"), settings);
  writeFileSync(join(repo, "models.json"), models);
  for (let i = 0; i < 2; i++) {
    const result = run();
    succeeded(result);
    assert.match(result.stdout, /--- .*settings\.example\.json/);
    assert.match(result.stdout, /\+\+\+ .*models\.json/);
    assert.match(result.stdout, /localhost:6655/);
    assert.doesNotMatch(result.stdout + result.stderr, /private-key|private-header/);
    assert.equal(readFileSync(join(repo, "settings.json"), "utf8"), settings);
    assert.equal(readFileSync(join(repo, "models.json"), "utf8"), models);
  }
});

test("existing config symlinks and their targets survive installation", (t) => {
  const { repo, home, run } = fixture(t);
  const target = join(home, "custom-settings.json");
  const content = '{"theme":"light"}\n';
  writeFileSync(target, content);
  symlinkSync(target, join(repo, "settings.json"));
  succeeded(run());
  assert.equal(lstatSync(join(repo, "settings.json")).isSymbolicLink(), true);
  assert.equal(readlinkSync(join(repo, "settings.json")), target);
  assert.equal(readFileSync(target, "utf8"), content);
});

test("dangling config symlinks are not silently replaced or written through", (t) => {
  const { repo, home, run } = fixture(t);
  const target = join(home, "missing-settings.json");
  symlinkSync(target, join(repo, "settings.json"));
  assert.notEqual(run().status, 0);
  assert.equal(readlinkSync(join(repo, "settings.json")), target);
  assert.equal(existsSync(target), false);
});

for (const name of ["settings", "models"]) {
  test(`conflicting agent ${name}.json is not overwritten`, (t) => {
    const { repo, home, run } = fixture(t);
    const agent = join(home, ".pi/agent");
    mkdirSync(agent, { recursive: true });
    const content = '{"existing":"machine-specific"}\n';
    const config = join(agent, `${name}.json`);
    writeFileSync(config, content);
    const result = run();
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(config, "utf8"), content);
    assert.equal(lstatSync(config).isSymbolicLink(), false);
    assert.equal(existsSync(join(home, "commands.log")), false);
    assert.equal(existsSync(join(repo, `${name}.json`)), true);
  });
}

test("malformed local JSON fails before installing packages without leaking contents", (t) => {
  const { repo, home, run } = fixture(t);
  writeFileSync(join(repo, "settings.json"), '{"apiKey":"secret-invalid-json"');
  const result = run();
  assert.notEqual(result.status, 0);
  assert.equal(existsSync(join(home, "commands.log")), false);
  assert.doesNotMatch(result.stdout + result.stderr, /secret-invalid-json/);
});

function compare(t, template, local) {
  const { repo } = fixture(t);
  const left = join(repo, "left.json");
  const right = join(repo, "right.json");
  writeFileSync(left, template);
  writeFileSync(right, local);
  return spawnSync(process.execPath, [join(root, "scripts/config-diff.mjs"), left, right], { encoding: "utf8" });
}

test("diff ignores JSON formatting and object key order", (t) => {
  const result = compare(t, '{"theme":"dark","nested":{"b":2,"a":1}}', '{\n "nested": {"a":1,"b":2}, "theme":"dark"\n}');
  succeeded(result);
  assert.equal(result.stdout, "");
});

test("diff redacts nested API keys, headers, and proxy credentials", (t) => {
  const result = compare(t, '{}', '{"providers":{"test":{"apiKey":"secret-key","headers":{"X-Token":"secret-header"}}},"httpProxy":"http://user:secret-password@proxy"}');
  succeeded(result);
  assert.match(result.stdout, /<redacted>/);
  assert.doesNotMatch(result.stdout + result.stderr, /secret-key|secret-header|secret-password/);
});

test("diff rejects malformed input without printing its contents", (t) => {
  const result = compare(t, '{}', '{"apiKey":"secret-invalid-json"');
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stdout + result.stderr, /secret-invalid-json/);
});
