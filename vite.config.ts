import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { askPolicyPlugin } from './server/ask';
import { projectsPlugin } from './server/projects';
import { servicingPlugin } from './server/servicing';
import { stockPlugin } from './server/stock';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      askPolicyPlugin(env.ANTHROPIC_API_KEY),
      projectsPlugin(),
      stockPlugin(),
      servicingPlugin({ url: env.SERVICE_LOG_SCRIPT_URL, token: env.SERVICE_LOG_TOKEN }),
    ],
  };
});
