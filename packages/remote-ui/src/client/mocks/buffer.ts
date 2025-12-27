// Minimal Buffer polyfill
// If 'buffer' package is not available, we need a custom implementation

export const Buffer = {
    from: (data: any, encoding?: string) => {
        if (encoding === 'base64') {
             const binary = atob(data);
             const bytes = new Uint8Array(binary.length);
             for (let i = 0; i < binary.length; i++) {
                 bytes[i] = binary.charCodeAt(i);
             }
             return {
                 toString: () => new TextDecoder().decode(bytes)
             };
        }
        if (data instanceof Uint8Array) {
             return {
                 toString: (enc?: string) => {
                     if (enc === 'hex') {
                         return Array.from(data).map(b => b.toString(16).padStart(2, '0')).join('');
                     }
                     return new TextDecoder().decode(data);
                 }
             };
        }
        return {
            toString: () => String(data)
        };
    }
};
