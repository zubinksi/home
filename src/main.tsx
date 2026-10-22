import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './ErrorBoundary';
import { Gate } from './Gate';
import { applyLamplight } from './lamplight';
import './styles.css';

applyLamplight();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Gate>
        <App />
      </Gate>
    </ErrorBoundary>
  </StrictMode>,
);
