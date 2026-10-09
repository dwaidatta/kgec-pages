import { test } from "node:test";
import assert from "node:assert/strict";
import "./setup.js";
import { fillLayoutWithUser } from "../website/lib/pdf-generate.js";

const baseLayout = {
  label: "Default",
  detailsSpace: {
    fontSize: 7,
    rows: [
      { label: "Name", linkedField: "name", value: "" },
      { label: "Subject", linkedField: null, value: "Data Structures" },
    ],
  },
};

test("fillLayoutWithUser fills linked rows from the user object", () => {
  const filled = fillLayoutWithUser(baseLayout, { name: "Jane Doe" });
  assert.equal(filled.detailsSpace.rows[0].value, "Jane Doe");
});

test("fillLayoutWithUser leaves unlinked rows untouched", () => {
  const filled = fillLayoutWithUser(baseLayout, { name: "Jane Doe" });
  assert.equal(filled.detailsSpace.rows[1].value, "Data Structures");
});

test("fillLayoutWithUser defaults a linked row to an empty string when the user field is missing", () => {
  const filled = fillLayoutWithUser(baseLayout, {});
  assert.equal(filled.detailsSpace.rows[0].value, "");
});

test("fillLayoutWithUser defaults linked rows to an empty string when there is no user at all", () => {
  const filled = fillLayoutWithUser(baseLayout, null);
  assert.equal(filled.detailsSpace.rows[0].value, "");
});

test("fillLayoutWithUser does not mutate the original layout", () => {
  const original = JSON.parse(JSON.stringify(baseLayout));
  fillLayoutWithUser(baseLayout, { name: "Jane Doe" });
  assert.deepEqual(baseLayout, original);
});
