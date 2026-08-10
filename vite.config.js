import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

export default defineConfig({
  base: '/estonian_b1_flashcards/',
  plugins: [solid()],
  build: {
    target: 'esnext',
  },
});
