import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getAdminDb, getUserFromToken } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
    try {
        const { sessionId, name, idToken } = await request.json();
        const safeName = String(name || '').trim().slice(0, 12);
        if (!sessionId || !safeName) {
            return NextResponse.json({ error: 'invalid-request' }, { status: 400 });
        }

        const user = await getUserFromToken(idToken);
        const adminDb = getAdminDb();
        const sessionRef = adminDb.collection('gameSessions').doc(sessionId);
        const result = await adminDb.runTransaction(async (transaction) => {
            const snapshot = await transaction.get(sessionRef);
            if (!snapshot.exists) return { missing: true };

            const session = snapshot.data();
            if (session.status !== 'won' || session.registered) {
                return { rejected: true };
            }

            transaction.set(adminDb.collection('rankings').doc(), {
                name: safeName,
                difficulty: session.difficulty,
                seconds: session.seconds,
                ...(user ? { userId: user.uid } : {}),
                createdAt: FieldValue.serverTimestamp(),
            });
            transaction.update(sessionRef, {
                registered: true,
                registeredAt: FieldValue.serverTimestamp(),
            });

            return { ok: true, difficulty: session.difficulty };
        });

        if (result.missing) {
            return NextResponse.json({ error: 'not-found' }, { status: 404 });
        }
        if (result.rejected) {
            return NextResponse.json({ error: 'not-eligible' }, { status: 409 });
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('game/register failed', error);
        return NextResponse.json(
            { error: 'server-unavailable' },
            { status: 503 },
        );
    }
}
