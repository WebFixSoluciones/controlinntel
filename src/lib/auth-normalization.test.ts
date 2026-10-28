import test from "node:test";
import assert from "node:assert/strict";

function normalizePasswordVariants(password: string): string[] {
  const cleanPassword = password.trim();
  const variants: string[] = [cleanPassword];
  const normalizedX = cleanPassword.replace(/[\u00d7\u2715\u2716\u2a09]/g, "x");
  if (normalizedX !== cleanPassword) variants.push(normalizedX);
  const normalizedCross = cleanPassword.replace(/x/g, "×");
  if (normalizedCross !== cleanPassword && !variants.includes(normalizedCross)) variants.push(normalizedCross);
  return variants;
}

test("Auth Normalization - converts multiplication sign to letter x", () => {
  const input = "awEEy@REpw&C98×4NRT5";
  const variants = normalizePasswordVariants(input);
  assert.equal(variants.length, 2);
  assert.equal(variants[0], "awEEy@REpw&C98×4NRT5");
  assert.equal(variants[1], "awEEy@REpw&C98x4NRT5");
});

test("Auth Normalization - converts letter x to multiplication sign variant", () => {
  const input = "awEEy@REpw&C98x4NRT5";
  const variants = normalizePasswordVariants(input);
  assert.equal(variants.length, 2);
  assert.equal(variants[0], "awEEy@REpw&C98x4NRT5");
  assert.equal(variants[1], "awEEy@REpw&C98×4NRT5");
});

test("Auth Normalization - trims accidental leading and trailing whitespace", () => {
  const input = "  awEEy@REpw&C98x4NRT5 \n";
  const variants = normalizePasswordVariants(input);
  assert.equal(variants[0], "awEEy@REpw&C98x4NRT5");
  assert.equal(variants[1], "awEEy@REpw&C98×4NRT5");
});

test("Auth Normalization - preserves clean alphanumeric and symbol passwords", () => {
  const input = "SecurePass#2026!";
  const variants = normalizePasswordVariants(input);
  assert.equal(variants.length, 1);
  assert.equal(variants[0], "SecurePass#2026!");
});
