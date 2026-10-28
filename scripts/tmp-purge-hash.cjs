const admin = require("firebase-admin");

const UIDS = ["usr-superadmin-00", "usr-1792255065314", "usr-1793054469313"];

(async () => {
  admin.initializeApp({
    projectId: "inntelcorp-45c89",
    credential: admin.credential.applicationDefault(),
  });
  const db = admin.firestore();

  for (const uid of UIDS) {
    const ref = db.collection("users").doc(uid);
    const before = await ref.get();
    if (!before.exists) {
      console.log(`${uid}: NO EXISTE`);
      continue;
    }
    if (!("passwordHash" in before.data())) {
      console.log(`${uid}: ya sin passwordHash`);
      continue;
    }
    await ref.update({
      passwordHash: admin.firestore.FieldValue.delete(),
      lastUpdated: new Date().toISOString(),
    });
    const after = await ref.get();
    console.log(
      `${uid}: eliminado | passwordHash presente: ${"passwordHash" in after.data()} | permisos: ${JSON.stringify(after.data().permissions)}`
    );
  }
  process.exit(0);
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
