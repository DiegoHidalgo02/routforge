// App web (D-STACK-1): `npm run dev`, `npm run build`. I test hanno la loro configurazione (vitest.config.ts).
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({ plugins: [react()] });
