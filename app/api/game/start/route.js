import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getAdminDb, getUserFromToken } from '@/lib/firebaseAdmin';
import { createRiceGame, GAME_MODES } from '@/lib/gameServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
    try {
        const { difficulty, idToken } = await request.json();
        if (!GAME_MODES[difficulty]) {
            return NextResponse.json(
                { error: 'invalid-difficulty' },
                { status: 400 },
            );
        }

        const user = await getUserFromToken(idToken);
        const adminDb = getAdminDb();
        const game = createRiceGame(difficulty);
        const startedAt = Date.now();

        await adminDb.collection('gameSessions').doc(game.sessionId).set({
            difficulty,
            answer: game.answer,
            startedAt,
            status: 'active',
            registered: false,
            ...(user ? { userId: user.uid } : {}),
            createdAt: FieldValue.serverTimestamp(),
        });

        return NextResponse.json({
            sessionId: game.sessionId,
            difficulty,
            startedAt,
            riceData: game.riceData,
        });
    } catch (error) {
        console.error('game/start failed', error);
        return NextResponse.json(
            { error: 'server-unavailable' },
            { status: 503 },
        );
    }
}
