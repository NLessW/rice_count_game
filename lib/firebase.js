import { initializeApp, getApps } from 'firebase/app';
import {
    createUserWithEmailAndPassword,
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
} from 'firebase/auth';
import {
    collection,
    getDocs,
    getDoc,
    getFirestore,
    limit,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    deleteDoc,
    doc,
    where,
} from 'firebase/firestore';

const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const enabled = Boolean(config.apiKey && config.projectId && config.appId);
const app = enabled ? (getApps().length ? getApps()[0] : initializeApp(config)) : null;
const db = app ? getFirestore(app) : null;
const auth = app ? getAuth(app) : null;

const localKey = 'rice-count-rankings';

function localScores() {
    if (typeof window === 'undefined') return [];
    try {
        return JSON.parse(localStorage.getItem(localKey) || '[]');
    } catch {
        return [];
    }
}

async function currentIdToken() {
    return auth?.currentUser ? auth.currentUser.getIdToken() : null;
}

async function postGameApi(path, payload) {
    const response = await fetch(`/api/game/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...payload,
            idToken: await currentIdToken(),
        }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'game-api-error');
    return data;
}

export async function startGameSession(difficulty) {
    return postGameApi('start', { difficulty });
}

export async function submitGameGuess(sessionId, guess) {
    return postGameApi('submit', { sessionId, guess });
}

export async function recordGameAction(sessionId) {
    return postGameApi('action', { sessionId });
}

export async function forfeitGameSession(sessionId) {
    return postGameApi('forfeit', { sessionId });
}

export async function registerGameSessionScore(sessionId, name) {
    return postGameApi('register', { sessionId, name });
}

export function observeAuth(callback) {
    if (!auth) {
        callback(null);
        return () => {};
    }
    return onAuthStateChanged(auth, callback);
}

export async function signUp({ email, password, name }) {
    if (!auth) throw new Error('firebase-disabled');
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName: name.slice(0, 12) });
    return credential.user;
}

export async function logIn({ email, password }) {
    if (!auth) throw new Error('firebase-disabled');
    return (await signInWithEmailAndPassword(auth, email, password)).user;
}

export async function logOut() {
    if (auth) await signOut(auth);
}

export async function loadMyScores(userId) {
    if (!db || !userId) return [];
    const snapshot = await getDocs(
        query(collection(db, 'rankings'), where('userId', '==', userId)),
    );
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function loadMyResults(userId) {
    if (!db || !userId) return [];
    const snapshot = await getDocs(
        query(collection(db, 'gameResults'), where('userId', '==', userId)),
    );
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function saveGameState(userId, state) {
    if (!db || !auth?.currentUser || auth.currentUser.uid !== userId) {
        throw new Error('auth-required');
    }
    await setDoc(doc(db, 'gameSaves', userId), {
        userId,
        ...state,
        savedAt: serverTimestamp(),
    });
}

export async function loadGameState(userId) {
    if (!db || !userId) return null;
    const snapshot = await getDoc(doc(db, 'gameSaves', userId));
    if (!snapshot.exists()) return null;
    const { answer: _legacyAnswer, ...safeState } = snapshot.data();
    return safeState;
}

export async function clearGameState(userId) {
    if (!db || !userId) return;
    await deleteDoc(doc(db, 'gameSaves', userId));
}

export async function loadScores(difficulty) {
    if (!db) {
        return localScores()
            .filter((score) => score.difficulty === difficulty)
            .sort((a, b) => a.seconds - b.seconds)
            .slice(0, 10);
    }
    const snapshot = await getDocs(
        query(
            collection(db, 'rankings'),
            where('difficulty', '==', difficulty),
            orderBy('seconds', 'asc'),
            limit(10),
        ),
    );
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export const firebaseEnabled = enabled;
