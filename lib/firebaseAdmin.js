import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

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

const app = getApps().length ? getApps()[0] : initializeApp(adminConfig);

export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);

export async function getUserFromToken(idToken) {
    if (!idToken) return null;
    try {
        return await adminAuth.verifyIdToken(idToken);
    } catch {
        return null;
    }
}
