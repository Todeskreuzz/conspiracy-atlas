import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/playfair-display/700.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/special-elite/400.css';
import '@fontsource/caveat/400.css';
import '@fontsource/caveat/700.css';
import '@fontsource/permanent-marker/400.css';
import './styles/global.css';
import './styles/wall.css';
import './styles/board.css';
import './styles/tabs.css';
import './styles/profile.css';
import './styles/admin.css';
import { App } from './App';
import { armScrollReveal, installEffects, reloadOnStaleChunks } from './effects';

installEffects();
armScrollReveal();
reloadOnStaleChunks();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
