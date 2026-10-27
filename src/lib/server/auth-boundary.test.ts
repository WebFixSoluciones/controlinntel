import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("P0: no authentication fallback or privileged seeded account is shipped",()=>{
  const state=fs.readFileSync("src/lib/state.tsx","utf8"), seeds=fs.readFileSync("src/lib/mock-data.ts","utf8");
  const login=state.slice(state.indexOf("  const login = async"),state.indexOf("  const logout ="));
  assert.match(login,/signInWithEmailAndPassword/); assert.match(login,/api<UserProfile>\("\/api\/session"\)/);
  assert.doesNotMatch(login,/passwordHash|masterProfile|isMasterPassword|SYSTEM_ACCOUNTS/);
  assert.doesNotMatch(seeds,/Inntel2026\*|SuperAdmin2026\*|Admin2026\*/);
  assert.match(seeds,/INITIAL_SYSTEM_USERS: SystemUser\[\] = \[\]/);
  const restoration=state.slice(state.indexOf("// Initial load"),state.indexOf("// Only Firebase identity"));
  assert.doesNotMatch(restoration,/setIsAuthenticated\(true\)/);
});

test("P0: data synchronization cannot retry through direct Firestore writes",()=>{
  const state=fs.readFileSync("src/lib/state.tsx","utf8");
  const synchronization=state.slice(state.indexOf("  const syncToFirestore"),state.indexOf("  // Initial load"));
  assert.doesNotMatch(synchronization,/setDoc\(|deleteDoc\(|catch\s*\(/);
  const rules=fs.readFileSync("firestore.rules","utf8");
  assert.match(rules,/allow read, write: if false/); assert.doesNotMatch(rules,/allow.+if (?:isAuthenticated|request\.auth)/);
});
