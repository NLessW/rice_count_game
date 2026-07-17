import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { adminDb, getUserFromToken } from '@/lib/firebaseAdmin';

export async function POST(request) {
    try {
        const { sessionId, guess, idToken } = await request.json();
        const numericGuess = Number(guess);
        if (!sessionId || !Number.isInteger(numericGuess)) {
            return NextResponse.json({ error: 'invalid-request' }, { status: 400 });
        }

        const user = await getUserFromToken(idToken);
        const sessionRef = adminDb.collection('gameSessions').doc(sessionId);
        const result = await adminDb.runTransaction(async (transaction) => {
            const snapshot = await transaction.get(sessionRef);
            if (!snapshot.exists) return { missing: true };

            const session = snapshot.data();
            if (session.status === 'forfeit') {
                return { terminal: true, correct: false };
            }

            const seconds = Number(
                ((Date.now() - session.startedAt) / 1000).toFixed(3),
            );
            const correct = numericGuess === session.answer;
            if (!correct) return { correct: false };

            if (session.status !== 'won') {
                transaction.update(sessionRef, {
                    status: 'won',
                    seconds,
                    wonAt: FieldValue.serverTimestamp(),
                    ...(user ? { userId: user.uid } : {}),
                });

                if (user) {
                    transaction.set(adminDb.collection('gameResults').doc(), {
                        userId: user.uid,
                        difficulty: session.difficulty,
                        won: true,
                        seconds,
                        createdAt: FieldValue.serverTimestamp(),
                    });
                }
            }

            return {
                correct: true,
                seconds: session.status === 'won' ? session.seconds : seconds,
            };
        });

        if (result.missing) {
            return NextResponse.json({ error: 'not-found' }, { status: 404 });
        }

        return NextResponse.json(result);
    } catch {
        return NextResponse.json(
            { error: 'server-unavailable' },
            { status: 503 },
        );
    }
}
