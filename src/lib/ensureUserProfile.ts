// src/lib/ensureUserProfile.ts
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";

export async function ensureUserProfile() {
  const auth = getAuth();
  const db = getFirestore();
  const u = auth.currentUser;
  if (!u) return;

  await setDoc(
    doc(db, "users", u.uid),
    {
      email: u.email ?? "",
      username: u.displayName ?? "",
      displayName: u.displayName ?? "",
      isActive: true,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}
