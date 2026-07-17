import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getAdminDb, getUserFromToken } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIN_ACTION_INTERVAL_MS = 140;

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
            if (session.status !== 'active') return { ok: false };

            const now = Date.now();
            const lastActionAt = session.lastActionAt || 0;
            if (now - lastActionAt < MIN_ACTION_INTERVAL_MS) {
                return { ok: true, counted: false };
            }

            transaction.update(sessionRef, {
                actionCount: (session.actionCount || 0) + 1,
                lastActionAt: now,
                lastActionRecordedAt: FieldValue.serverTimestamp(),
                ...(user ? { userId: user.uid } : {}),
            });

            return { ok: true, counted: true };
        });

        if (result.missing) {
            return NextResponse.json({ error: 'not-found' }, { status: 404 });
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('game/action failed', error);
        return NextResponse.json(
            { error: 'server-unavailable' },
            { status: 503 },
        );
    }
}
