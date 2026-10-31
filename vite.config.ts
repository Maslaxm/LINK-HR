import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const REQUIRED_FIREBASE_ENV = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), '');
  const env = { ...fileEnv, ...process.env };
  const missing = REQUIRED_FIREBASE_ENV.filter((key) => !env[key]?.trim());

  if (mode === 'production') {
    if (missing.length) {
      throw new Error(
        `Missing required Firebase environment variables: ${missing.join(', ')}. ` +
          'Set them in Netlify under Site configuration > Environment variables.',
      );
    }
    if (env.VITE_USE_EMULATORS === 'true') {
      throw new Error('VITE_USE_EMULATORS must not be true in a production build.');
    }
  } else if (missing.length) {
    console.warn(`LINK HR: missing Firebase environment variables: ${missing.join(', ')}`);
  }

  return {
    plugins: [react()],
    server: { port: 5173 },
    build: {
      target: 'es2022',
      sourcemap: false,
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks: {
            firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/functions'],
            vendor: ['react', 'react-dom', 'react-router-dom'],
          },
        },
      },
    },
  };
});
