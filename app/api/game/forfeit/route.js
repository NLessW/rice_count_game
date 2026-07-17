import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getAdminDb, getUserFromToken } from '@/lib/firebaseAdmin';

export async function POST(request) {
    try {
        const { sessionId, idToken } = await request.json();
        if (!sessionId) {
            return NextResponse.json({ error: 'invalid-request' }, { status: 400 });
        }

        const user = await getUserFromToken(idToken);
        const adminDb = getAdminDb();
        const sessionRef = adminDb.collection('gameSessions').doc(sessionId);
        const result = await adminDb.runTransaction(async (transaction) => {
            const snapshot = await transaction.get(sessionRef);
            if (!snapshot.exists) return { missing: true };

            const session = snapshot.data();
            const seconds = Number(
                ((Date.now() - session.startedAt) / 1000).toFixed(3),
            );

            if (session.status === 'active') {
                transaction.update(sessionRef, {
                    status: 'forfeit',
                    seconds,
                    forfeitedAt: FieldValue.serverTimestamp(),
                    ...(user ? { userId: user.uid } : {}),
                });

                if (user) {
                    transaction.set(adminDb.collection('gameResults').doc(), {
                        userId: user.uid,
                        difficulty: session.difficulty,
                        won: false,
                        seconds,
                        createdAt: FieldValue.serverTimestamp(),
                    });
                }
            }

            return {
                answer: session.answer,
                seconds: session.status === 'active' ? seconds : session.seconds,
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
