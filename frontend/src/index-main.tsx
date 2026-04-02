import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import { AppProvider } from './context/AppContext';
import { ConfirmProvider } from './context/ConfirmContext';
import IndexApp from './IndexApp';
import '../styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AppProvider>
        <ConfirmProvider>
          <IndexApp />
        </ConfirmProvider>
      </AppProvider>
    </HashRouter>
  </StrictMode>,
);
