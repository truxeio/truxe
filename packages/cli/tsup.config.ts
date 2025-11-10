import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  format: ['cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  outDir: 'dist',
  target: 'node20',
  banner: {
    js: '#!/usr/bin/env node',
  },
  // Externalize native modules and Node.js built-ins
  external: [
    'pg',
    'redis',
    // Node.js built-ins are automatically externalized
  ],
  // Bundle other dependencies for easier distribution
  noExternal: [],
});

