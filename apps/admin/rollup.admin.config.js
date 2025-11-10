import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import postcss from 'rollup-plugin-postcss';
import dts from 'rollup-plugin-dts';
import { terser } from 'rollup-plugin-terser';
import { visualizer } from 'rollup-plugin-visualizer';
import { sizeSnapshot } from 'rollup-plugin-size-snapshot';
import { readFileSync } from 'fs';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));

export default [
  // Main admin bundle
  {
    input: 'src/components/admin/index.ts',
    output: [
      {
        file: 'dist/admin.js',
        format: 'cjs',
        sourcemap: true,
        exports: 'named',
      },
      {
        file: 'dist/admin.esm.js',
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: [
      peerDepsExternal(),
      resolve({
        browser: true,
        preferBuiltins: false,
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.admin.json',
        exclude: ['**/*.test.*', '**/*.stories.*'],
        declaration: true,
        declarationDir: 'dist/admin',
      }),
      postcss({
        config: {
          path: './postcss.config.js',
        },
        extensions: ['.css'],
        minimize: true,
        inject: {
          insertAt: 'top',
        },
      }),
      terser({
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      }),
      sizeSnapshot({
        snapshotPath: 'dist/admin-size-snapshot.json',
      }),
      visualizer({
        filename: 'dist/admin-bundle-analysis.html',
        open: false,
        gzipSize: true,
        brotliSize: true,
      }),
    ],
    external: ['react', 'react-dom'],
  },
  
  // TypeScript declarations
  {
    input: 'dist/admin/index.d.ts',
    output: [{ file: 'dist/admin.d.ts', format: 'esm' }],
    plugins: [dts()],
    external: [/\.css$/],
  },
  
  // UMD build for CDN usage
  {
    input: 'src/components/admin/index.ts',
    output: {
      file: 'dist/admin.umd.js',
      format: 'umd',
      name: 'TruxeAdmin',
      sourcemap: true,
      globals: {
        react: 'React',
        'react-dom': 'ReactDOM',
      },
    },
    plugins: [
      peerDepsExternal(),
      resolve({
        browser: true,
        preferBuiltins: false,
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.admin.json',
        exclude: ['**/*.test.*', '**/*.stories.*'],
      }),
      postcss({
        config: {
          path: './postcss.config.js',
        },
        extensions: ['.css'],
        minimize: true,
        inject: {
          insertAt: 'top',
        },
      }),
      terser({
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      }),
    ],
    external: ['react', 'react-dom'],
  },
];

