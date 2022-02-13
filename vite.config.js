/** @type {import('vite').UserConfig} */
const config = {
    build: {
        outDir: './dist',
        lib: {
            entry: './src/index.ts',
            fileName: 'editor',
            formats: ['es', 'cjs'],
        }
    }
};

export default config;
