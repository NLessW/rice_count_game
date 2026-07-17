import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getAdminDb, getUserFromToken } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
    try {
        const { sessionId, guess, idToken } = await request.json();
        const numericGuess = Number(guess);
        if (!sessionId || !Number.isInteger(numericGuess)) {
            return NextResponse.json({ error: 'invalid-request' }, { status: 400 });
        }

        const user = await getUserFromToken(idToken);
        const adminDb = getAdminDb();
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
            const attempts = (session.attempts || 0) + 1;
            const correct = numericGuess === session.answer;
            transaction.update(sessionRef, {
                attempts,
                lastAttemptAt: FieldValue.serverTimestamp(),
            });
            if (!correct) return { correct: false };

            if (session.status !== 'won') {
                const rankEligible =
                    seconds >= (session.minimumRankSeconds || 60) &&
                    attempts <= 8;
                transaction.update(sessionRef, {
                    status: 'won',
                    seconds,
                    attempts,
                    rankEligible,
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
                rankEligible:
                    session.status === 'won'
                        ? session.rankEligible !== false
                        : seconds >= (session.minimumRankSeconds || 60) &&
                          attempts <= 8,
            };
        });

        if (result.missing) {
            return NextResponse.json({ error: 'not-found' }, { status: 404 });
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('game/submit failed', error);
        return NextResponse.json(
            { error: 'server-unavailable' },
            { status: 503 },
        );
    }
}
