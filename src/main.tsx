import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './ErrorBoundary';
import { Gate } from './Gate';
import './styles.css';
import { applyTheme } from './theme';

applyTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Gate>
        <App />
      </Gate>
    </ErrorBoundary>
  </StrictMode>,
);
