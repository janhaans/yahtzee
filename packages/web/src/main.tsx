import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@fontsource-variable/nunito';
import './styles/base.css';
import './styles/themes.css';
import './styles/dice.css';
import './styles/fun.css';
import './styles/start.css';
import './styles/setup.css';
import './styles/join.css';
import './styles/game.css';
import './styles/end.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
