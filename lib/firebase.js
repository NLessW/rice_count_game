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
    addDoc,
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

export async function saveScore(score) {
    const user = auth?.currentUser;
    const safe = {
        name: score.name.slice(0, 12),
        difficulty: score.difficulty,
        seconds: Number(score.seconds.toFixed(3)),
        createdAt: Date.now(),
    };
    if (db) {
        await addDoc(collection(db, 'rankings'), {
            ...safe,
            ...(user ? { userId: user.uid } : {}),
            createdAt: serverTimestamp(),
        });
    } else {
        const scores = [...localScores(), safe].sort(
            (a, b) => a.seconds - b.seconds,
        );
        localStorage.setItem(localKey, JSON.stringify(scores.slice(0, 100)));
    }
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

export async function recordGameResult({ difficulty, won, seconds }) {
    const user = auth?.currentUser;
    if (!db || !user) return;
    await addDoc(collection(db, 'gameResults'), {
        userId: user.uid,
        difficulty,
        won,
        seconds: Number(seconds.toFixed(3)),
        createdAt: serverTimestamp(),
    });
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
    return snapshot.exists() ? snapshot.data() : null;
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
