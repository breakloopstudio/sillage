import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

export const MAX_SCANS_PER_DAY = 30;
export const MAX_VOICE_PER_DAY = 60;

export async function checkAndIncrementQuota(
  db: admin.firestore.Firestore,
  uid: string,
  kind: 'scan' | 'voice',
  max: number,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const ref = db.doc(`rateLimits/${today}/users/${uid}`);

  await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const current = doc.exists ? (doc.data()?.[kind] ?? 0) as number : 0;
    if (current >= max) {
      throw new functions.https.HttpsError('resource-exhausted', `Limite quotidienne atteinte (${kind}).`);
    }
    tx.set(ref, { [kind]: admin.firestore.FieldValue.increment(1), uid }, { merge: true });
  });
}
