import test from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { observeVerifiedSession } from "./session-restoration.ts";

function session() {
  let emit!: (identity: string | null) => void;
  const states: string[] = [];
  const profiles = new Map<string, { resolve: (profile: string) => void; reject: (error: Error) => void }>();
  let unsubscribed = false;
  const dispose = observeVerifiedSession<string, string>({
    subscribe: (listener) => { emit = listener; return () => { unsubscribed = true; }; },
    loadProfile: (identity) => new Promise((resolve, reject) => { profiles.set(identity, { resolve, reject }); }),
    pending: () => states.push("restoring"),
    authenticated: (profile) => states.push(`authenticated:${profile}`),
    guest: () => states.push("login"),
    failed: () => states.push("failed"),
  });
  return { emit: (identity: string | null) => emit(identity), states, profiles, dispose, unsubscribed: () => unsubscribed };
}

test("reload keeps restoring while the persisted identity and server profile are being resolved", async () => {
  const s = session();
  s.emit("persisted-user");
  await setImmediate();
  assert.deepEqual(s.states, ["restoring"]);
  s.profiles.get("persisted-user")!.resolve("verified-user");
  await setImmediate();
  assert.deepEqual(s.states, ["restoring", "authenticated:verified-user"]);
});

test("the login is shown only when Firebase confirms there is no session", () => {
  const s = session(); s.emit(null);
  assert.deepEqual(s.states, ["restoring", "login"]);
});

test("a late validation cannot restore the previous user after sign-out", async () => {
  const s = session(); s.emit("previous-user"); await setImmediate();
  s.emit(null);
  s.profiles.get("previous-user")!.resolve("previous-user"); await setImmediate();
  assert.deepEqual(s.states, ["restoring", "restoring", "login"]);
});

test("unmount cancels late session results and unsubscribes from Firebase", async () => {
  const s = session(); s.emit("user"); await setImmediate(); s.dispose();
  s.profiles.get("user")!.resolve("user"); await setImmediate();
  assert.equal(s.unsubscribed(), true); assert.deepEqual(s.states, ["restoring"]);
});

test("a rejected profile never grants authenticated access", async () => {
  const s = session(); s.emit("disabled-user"); await setImmediate();
  s.profiles.get("disabled-user")!.reject(new Error("Inactive profile")); await setImmediate();
  assert.deepEqual(s.states, ["restoring", "failed"]);
});
