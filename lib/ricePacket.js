export const RICE_PACKET_WIDTH = 6;

export const packUnit = (value, mask) => Math.round(value * 100000) + mask;
export const unpackUnit = (value, mask) => (value - mask) / 100000;

export function packRiceData(riceRows, key) {
    return riceRows.flatMap(([place, first, second, rotation]) => {
        const marker = Math.floor(Math.random() * 80001) + 10000;
        return [
            packUnit(first, key[0]),
            packUnit(second, key[1]),
            packUnit(rotation / Math.PI, key[2]),
            marker + key[3],
            marker + key[4] + place,
            Math.floor(Math.random() * 90000) + 10000 + key[5],
        ];
    });
}

export function unpackRiceData(packet, key) {
    return Array.from({ length: packet.length / RICE_PACKET_WIDTH }, (_, id) => {
        const offset = id * RICE_PACKET_WIDTH;
        const place = packet[offset + 4] - packet[offset + 3] + key[3] - key[4];
        return {
            id,
            place,
            first: unpackUnit(packet[offset], key[0]),
            second: unpackUnit(packet[offset + 1], key[1]),
            rotation: unpackUnit(packet[offset + 2], key[2]) * Math.PI,
        };
    });
}
