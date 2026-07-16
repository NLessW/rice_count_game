import { initializeApp, getApps } from "firebase/app";
import {
  addDoc,
  collection,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where
} from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const enabled = Boolean(config.apiKey && config.projectId && config.appId);
const db = enabled
  ? getFirestore(getApps().length ? getApps()[0] : initializeApp(config))
  : null;

const localKey = "rice-count-rankings";

function localScores() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(localKey) || "[]");
  } catch {
    return [];
  }
}

export async function saveScore(score) {
  const safe = {
    name: score.name.slice(0, 12),
    difficulty: score.difficulty,
    seconds: Number(score.seconds.toFixed(2)),
    createdAt: Date.now()
  };
  if (db) {
    await addDoc(collection(db, "rankings"), {
      ...safe,
      createdAt: serverTimestamp()
    });
  } else {
    const scores = [...localScores(), safe].sort((a, b) => a.seconds - b.seconds);
    localStorage.setItem(localKey, JSON.stringify(scores.slice(0, 100)));
  }
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
      collection(db, "rankings"),
      where("difficulty", "==", difficulty),
      orderBy("seconds", "asc"),
      limit(10)
    )
  );
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export const firebaseEnabled = enabled;
