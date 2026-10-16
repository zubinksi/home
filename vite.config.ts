import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { askPolicyPlugin } from './server/ask';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), askPolicyPlugin(env.ANTHROPIC_API_KEY)],
  };
});
