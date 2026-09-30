import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths work both at a project path (user.github.io/idle-ascension/)
  // and at the root of a custom domain.
  base: './',
  plugins: [preact()],
});
