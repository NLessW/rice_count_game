import { randomUUID } from 'crypto';
import { packRiceData } from './ricePacket';

export const GAME_MODES = {
    easy: { min: 1000, max: 2000 },
    normal: { min: 2000, max: 4000 },
    hard: { min: 4000, max: 8000 },
};

export const RICE_SLOT_COUNT = 8000;

const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function createPacketKey() {
    return Array.from({ length: 6 }, () => random(1000, 9000));
}

export function createRiceGame(difficulty) {
    const mode = GAME_MODES[difficulty];
    if (!mode) throw new Error('invalid-difficulty');

    const answer = random(mode.min, mode.max);
    const seeded = Array.from({ length: RICE_SLOT_COUNT }, (_, id) => {
        if (id >= answer) {
            return [
                3,
                Number(Math.random().toFixed(5)),
                Number(Math.random().toFixed(5)),
                Number((Math.random() * Math.PI).toFixed(5)),
            ];
        }

        const angle = Math.random() * Math.PI * 2;
        const radius = Math.sqrt(Math.random()) * 0.82;
        return [
            0,
            Number((Math.cos(angle) * radius).toFixed(5)),
            Number((Math.sin(angle) * radius).toFixed(5)),
            Number((Math.random() * Math.PI).toFixed(5)),
        ];
    });

    for (let index = seeded.length - 1; index > 0; index -= 1) {
        const swapIndex = random(0, index);
        [seeded[index], seeded[swapIndex]] = [seeded[swapIndex], seeded[index]];
    }

    const packetKey = createPacketKey();

    return {
        sessionId: randomUUID(),
        answer,
        packetKey,
        riceData: packRiceData(seeded, packetKey),
    };
}

export function minimumRankSeconds(difficulty) {
    return {
        easy: 20,
        normal: 45,
        hard: 90,
    }[difficulty] ?? 60;
}

export function minimumRankActions(difficulty) {
    return {
        easy: 50,
        normal: 100,
        hard: 160,
    }[difficulty] ?? 80;
}
