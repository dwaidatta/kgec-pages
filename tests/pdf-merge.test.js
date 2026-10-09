import { test } from "node:test";
import assert from "node:assert/strict";
import "./setup.js";
import { sanitizeFilename, stripExtension, buildMergedFilename } from "../website/lib/pdf-merge.js";

test("sanitizeFilename strips characters illegal in filenames", () => {
  assert.equal(sanitizeFilename('a/b\\c:d*e?f"g<h>i|j'), "abcdefghij");
});

test("sanitizeFilename trims and collapses whitespace", () => {
  assert.equal(sanitizeFilename("  John   Doe  "), "John Doe");
});

test("sanitizeFilename returns an empty string for empty or nullish input", () => {
  assert.equal(sanitizeFilename(""), "");
  assert.equal(sanitizeFilename(null), "");
  assert.equal(sanitizeFilename(undefined), "");
});

test("stripExtension removes a trailing extension", () => {
  assert.equal(stripExtension("assignment.pdf"), "assignment");
});

test("stripExtension leaves names with no extension untouched", () => {
  assert.equal(stripExtension("assignment"), "assignment");
});

test("buildMergedFilename uses the sanitized label when one is given", () => {
  assert.equal(buildMergedFilename("Roll 12", [{ name: "front_page.pdf" }]), "Roll 12.pdf");
});

test("buildMergedFilename falls back to the first file's name (minus extension) when the label is blank", () => {
  assert.equal(buildMergedFilename("", [{ name: "front_page.pdf" }, { name: "assignment.pdf" }]), "front_page.pdf");
});

test("buildMergedFilename falls back to 'merged' when there is no label and no files", () => {
  assert.equal(buildMergedFilename("", []), "merged.pdf");
});

test("buildMergedFilename falls back to 'merged' when the label is only illegal characters", () => {
  assert.equal(buildMergedFilename("///", []), "merged.pdf");
});
