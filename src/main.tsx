import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './ErrorBoundary';
import { Gate } from './Gate';
import './styles.css';
import { applyLinen } from './linen';
import { applyTheme } from './theme';

applyTheme();
applyLinen();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Gate>
        <App />
      </Gate>
    </ErrorBoundary>
  </StrictMode>,
);
