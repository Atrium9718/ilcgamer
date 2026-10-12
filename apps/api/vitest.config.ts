import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC conserva los metadatos de decoradores que necesita la inyección de dependencias de NestJS.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['test/**/*.spec.ts'],
    // Las pruebas de integración comparten la base ilc_test: se ejecutan en serie.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
