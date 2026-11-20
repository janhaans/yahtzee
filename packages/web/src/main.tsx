import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { PlayerApp } from './phone/PlayerApp';
import '@fontsource-variable/nunito';
import './styles/base.css';
import './styles/themes.css';
import './styles/dice.css';
import './styles/fun.css';
import './styles/start.css';
import './styles/setup.css';
import './styles/join.css';
import './styles/phone.css';
import './styles/game.css';
import './styles/end.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* The phone has its own page; the History Dashboard follows in milestone 6. */}
    {window.location.pathname.startsWith('/speler') ? <PlayerApp /> : <App />}
  </StrictMode>,
);
