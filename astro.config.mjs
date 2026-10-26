import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://yetanotherainewsletter.org',
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
});
