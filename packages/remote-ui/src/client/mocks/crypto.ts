import { Buffer } from './buffer.js'; // Use our local mock

export function randomBytes(size: number) {
    const arr = new Uint8Array(size);
    window.crypto.getRandomValues(arr);
    return Buffer.from(arr);
}

export function createHash(algo: string) {
    return {
        update: () => ({ digest: () => 'mock-hash' })
    };
}
