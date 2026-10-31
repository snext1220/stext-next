import '@stext/ui/styles.css';
import '@xyflow/react/dist/style.css';
import './playground.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { HelpProvider } from './help/HelpPanel.js';

const root = document.getElementById('root');
if (!root) throw new Error('#root が見つかりません');

createRoot(root).render(
  <StrictMode>
    <HelpProvider>
      <App />
    </HelpProvider>
  </StrictMode>,
);
