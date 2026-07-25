import * as admin from 'firebase-admin';

export async function purgeDeadTokensForUser(
  db: admin.firestore.Firestore,
  uid: string,
  tokens: string[],
  responses: admin.messaging.SendResponse[],
): Promise<number> {
  const deadTokens = new Set<string>();
  for (let i = 0; i < tokens.length; i++) {
    const r = responses[i];
    if (!r.success) {
      const code = r.error?.code ?? '';
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
        deadTokens.add(tokens[i]);
      }
    }
  }
  if (deadTokens.size === 0) return 0;

  try {
    const batch = db.batch();
    const col = db.collection(`users/${uid}/fcmTokens`);
    const snap = await col.where('token', 'in', Array.from(deadTokens)).get();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  } catch (e: unknown) {
    console.warn('[fcm-utils] purgeDeadTokensForUser failed:', (e as Error)?.message ?? String(e));
    return 0;
  }
  return deadTokens.size;
}
