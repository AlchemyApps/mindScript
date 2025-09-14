import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/client/index.ts',
    'src/server/index.ts',
    'src/hooks/index.ts'
  ],
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: true,
  format: ['cjs', 'esm'],
  target: 'es2022',
  external: ['react', 'react-dom', 'next', '@supabase/ssr', '@supabase/supabase-js'],
});