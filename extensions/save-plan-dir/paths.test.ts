import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PLAN_PREFIXES,
  appendPlanLink,
  isPlanPath,
  planDir,
  planPrefixes,
  targetPathFor,
} from "./paths.ts";

test("isPlanPath matches known plan locations relative to cwd", () => {
  assert.equal(isPlanPath("docs/superpowers/plans/a.md", "/p"), true);
  assert.equal(isPlanPath("docs/superpowers/specs/a-design.md", "/p"), true);
  assert.equal(isPlanPath("/p/docs/plans/a.md", "/p"), true);
  assert.equal(isPlanPath("PLAN.md", "/p"), true);
  assert.equal(isPlanPath("./PLAN.md", "/p"), true);
});

test("isPlanPath rejects non-plan and out-of-project paths", () => {
  assert.equal(isPlanPath("docs/plans.md", "/p"), false);
  assert.equal(isPlanPath("../docs/plans/a.md", "/p"), false);
  assert.equal(isPlanPath("/other/docs/plans/a.md", "/p"), false);
  assert.equal(isPlanPath("README.md", "/p"), false);
  assert.equal(isPlanPath("docs/README.md", "/p"), false);
});

test("isPlanPath honours extra prefixes", () => {
  assert.equal(isPlanPath("notes/a.md", "/p"), false);
  assert.equal(isPlanPath("notes/a.md", "/p", [...DEFAULT_PLAN_PREFIXES, "notes/"]), true);
});

test("targetPathFor builds project-prefixed flat name", () => {
  assert.equal(targetPathFor("docs/plans/2026-11-05-x.md", "/home/u/proj", "/out"), "/out/proj--2026-11-05-x.md");
  assert.equal(targetPathFor("PLAN", "/home/u/proj", "/out"), "/out/proj--PLAN.md");
  assert.equal(targetPathFor("docs/specs/a.txt", "/home/u/proj", "/out"), "/out/proj--a.txt");
});

test("planDir uses env override or default", () => {
  assert.ok(planDir({}).endsWith("obsidian/strage/raw"));
  assert.equal(planDir({ PI_SAVE_PLAN_DIR: "/x" }), "/x");
});

test("planPrefixes appends env patterns to defaults", () => {
  assert.deepEqual(planPrefixes({}), DEFAULT_PLAN_PREFIXES);
  assert.deepEqual(planPrefixes({ PI_SAVE_PLAN_PATTERNS: "notes/, specs/" }), [...DEFAULT_PLAN_PREFIXES, "notes/", "specs/"]);
});

test("appendPlanLink creates file when missing", () => {
  assert.equal(appendPlanLink(null, "/out/a.md"), "# Agent notes\n\n## Plans\n\n- [a.md](/out/a.md)\n");
});

test("appendPlanLink adds section when missing", () => {
  assert.equal(appendPlanLink("# Notes\n\nText.\n", "/out/a.md"), "# Notes\n\nText.\n\n## Plans\n\n- [a.md](/out/a.md)\n");
});

test("appendPlanLink inserts inside existing section", () => {
  const input = "# Notes\n\n## Plans\n\n- [a.md](/out/a.md)\n\n## Other\n\nText.\n";
  const expected = "# Notes\n\n## Plans\n\n- [a.md](/out/a.md)\n- [b.md](/out/b.md)\n\n## Other\n\nText.\n";
  assert.equal(appendPlanLink(input, "/out/b.md"), expected);
});

test("appendPlanLink appends at end when section is last", () => {
  assert.equal(appendPlanLink("## Plans\n\n- [a.md](/out/a.md)\n", "/out/b.md"), "## Plans\n\n- [a.md](/out/a.md)\n- [b.md](/out/b.md)\n");
});

test("appendPlanLink returns null for duplicates", () => {
  assert.equal(appendPlanLink("## Plans\n\n- [a.md](/out/a.md)\n", "/out/a.md"), null);
});
