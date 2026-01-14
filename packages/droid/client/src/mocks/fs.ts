export const existsSync = () => false;
export const promises = {
    readFile: async () => '',
    writeFile: async () => {},
};
export const readFileSync = () => '';
export default { existsSync, promises, readFileSync };
