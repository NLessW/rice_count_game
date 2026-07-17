import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function normalizePrivateKey(value) {
    return value
        ?.trim()
        .replace(/^['"]|['"]$/g, '')
        .replace(/\\n/g, '\n');
}

function getServiceAccountCredential() {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
        const decoded = Buffer.from(
            process.env.FIREBASE_SERVICE_ACCOUNT_BASE64.trim(),
            'base64',
        ).toString('utf8');
        return cert(JSON.parse(decoded));
    }

    const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
    if (!process.env.FIREBASE_CLIENT_EMAIL || !privateKey) return null;

    return cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
    });
}

function getAdminApp() {
    if (getApps().length) return getApps()[0];

    const credential = getServiceAccountCredential();
    const adminConfig =
        credential
            ? { credential }
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
