import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function normalizePrivateKey(value) {
    return value
        ?.trim()
        .replace(/^['"]|['"]$/g, '')
        .replace(/\\n/g, '\n');
}

function getAdminApp() {
    if (getApps().length) return getApps()[0];

    const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
    const adminConfig =
        process.env.FIREBASE_CLIENT_EMAIL && privateKey
            ? {
                  credential: cert({
                      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                      privateKey,
                  }),
              }
            : {
                  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
              };

    return initializeApp(adminConfig);
}

export function getAdminDb() {
    return getFirestore(getAdminApp());
}

export async function getAdminAuth() {
    const { getAuth } = await import('firebase-admin/auth');
    return getAuth(getAdminApp());
}

export async function getUserFromToken(idToken) {
    if (!idToken) return null;
    try {
        return await (await getAdminAuth()).verifyIdToken(idToken);
    } catch {
        return null;
    }
}
