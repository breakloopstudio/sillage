// functions/src/account.ts — Cloud Functions RGPD : suppression & export de données
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

const REAUTH_WINDOW_S = 300;

export const deleteUserAccount = functions.https.onCall(
  { region: 'europe-west1' },
  async (request: functions.https.CallableRequest): Promise<{ success: true }> => {
    if (!request.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentification requise.');
    }
    const uid = request.auth.uid;
    const authTime = (request.auth.token.auth_time as number) ?? 0;
    if (Date.now() / 1000 - authTime > REAUTH_WINDOW_S) {
      throw new functions.https.HttpsError('failed-precondition', 'REAUTH_REQUIRED');
    }
    try {
      await admin.firestore().recursiveDelete(db.doc(`users/${uid}`));
      await admin.auth().deleteUser(uid);
      console.log('[deleteUserAccount] deleted', uid, new Date().toISOString());
      return { success: true };
    } catch (e: unknown) {
      const err = e as { code?: string; details?: unknown };
      if (err.code && typeof err.code === 'string') {
        throw new functions.https.HttpsError(
          (err.code as 'internal') ?? 'internal',
          'La suppression a échoué. Réessayez plus tard.',
        );
      }
      throw new functions.https.HttpsError('internal', 'La suppression a échoué. Réessayez plus tard.');
    }
  },
);

// Helper de sérialisation récursive
function serializeValue(v: unknown): unknown {
  if (v instanceof admin.firestore.Timestamp) return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(serializeValue);
  if (v !== null && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(v as Record<string, unknown>)) {
      out[key] = serializeValue((v as Record<string, unknown>)[key]);
    }
    return out;
  }
  return v;
}

export const exportUserData = functions.https.onCall(
  { region: 'europe-west1' },
  async (request: functions.https.CallableRequest): Promise<Record<string, unknown>> => {
    if (!request.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentification requise.');
    }
    const uid = request.auth.uid;

    try {
      const [
        favorisSnap, wardrobeSnap, scansSnap, shelvesSnap, sotdSnap,
        collectionSnap, scentlistSnap, priceAlertsSnap, settingsSnap, usageSnap,
      ] = await Promise.all([
        db.collection(`users/${uid}/favoris`).get(),
        db.collection(`users/${uid}/wardrobe`).get(),
        db.collection(`users/${uid}/scans`).get(),
        db.collection(`users/${uid}/shelves`).get(),
        db.collection(`users/${uid}/sotd`).get(),
        db.collection(`users/${uid}/collection`).get(),
        db.collection(`users/${uid}/scentlist`).get(),
        db.collection(`users/${uid}/priceAlerts`).get(),
        db.doc(`users/${uid}/settings/preferences`).get(),
        db.collection(`users/${uid}/usage`).get(),
      ]);

      let userProfile: Record<string, unknown> = {};
      try {
        const u = await admin.auth().getUser(uid);
        userProfile = {
          uid: u.uid,
          email: u.email ?? null,
          displayName: u.displayName ?? null,
          providers: (u.providerData ?? []).map(p => p.providerId),
          creationTime: u.metadata.creationTime ?? null,
          lastSignInTime: u.metadata.lastSignInTime ?? null,
        };
      } catch { /* ignore auth fetch failures */ }

      return serializeValue({
        exportedAt: new Date().toISOString(),
        app: 'ParfumScan',
        version: '1.0.0',
        profile: userProfile,
        collections: {
          favoris: favorisSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          wardrobe: wardrobeSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          scans: scansSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          shelves: shelvesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          sotd: sotdSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          collection: collectionSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          scentlist: scentlistSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          priceAlerts: priceAlertsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          settings: settingsSnap.exists ? settingsSnap.data() : null,
          usage: usageSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        },
        excluded: [{ collection: 'fcmTokens', reason: 'Identifiants techniques de notification, régénérés automatiquement' }],
      }) as Record<string, unknown>;
    } catch (e: unknown) {
      console.warn('[exportUserData] failed:', (e as Error)?.message ?? String(e));
      throw new functions.https.HttpsError('internal', "L'export de données a échoué. Réessayez plus tard.");
    }
  },
);
