/** Keep the sign-in screen hidden until Firebase and the server resolve the session. */
export function observeVerifiedSession<Identity, Profile>(options: {
  subscribe: (listener: (identity: Identity | null) => void) => () => void;
  loadProfile: (identity: Identity) => Promise<Profile>;
  pending: () => void;
  authenticated: (profile: Profile) => void;
  guest: () => void;
  failed: (error: unknown) => void;
}) {
  let generation = 0;
  const unsubscribe = options.subscribe((identity) => {
    const request = ++generation;
    options.pending();
    if (!identity) {
      options.guest();
      return;
    }
    void Promise.resolve().then(() => options.loadProfile(identity)).then(
      (profile) => { if (request === generation) options.authenticated(profile); },
      (error: unknown) => { if (request === generation) options.failed(error); },
    );
  });
  return () => { generation++; unsubscribe(); };
}
