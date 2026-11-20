import { useEffect } from 'react';
import type { ThemeId } from '@yahtzee/server/looks';
import { nl } from '../i18n/nl';
import { reducedMotion } from '../motion';
import { celebrateYahtzee, stopConfetti } from './confetti';

export const CELEBRATION_MS = 3200;

interface Props {
  theme: ThemeId;
  onDone: () => void;
}

/**
 * The giant "YAHTZEE!!!" moment. Soccer: a ball flies into the net, "GOOOAL!" and fireworks.
 * Sweets: it rains sweets and sprinkles. A tap ends it early.
 */
export function YahtzeeCelebration({ theme, onDone }: Props) {
  const calm = reducedMotion();

  useEffect(() => {
    const stop = calm ? () => {} : celebrateYahtzee(theme);
    const timer = setTimeout(onDone, CELEBRATION_MS);
    return () => {
      clearTimeout(timer);
      stop();
      stopConfetti();
    };
  }, [theme, calm, onDone]);

  return (
    <div
      className={`celebration celebration-${theme}${calm ? ' calm' : ''}`}
      role="alert"
      onClick={onDone}
    >
      {theme === 'voetbal' && !calm && (
        <div className="goal" aria-hidden="true">
          <div className="net" />
          <span className="ball">⚽</span>
        </div>
      )}
      <p className="yahtzee-text">{nl.celebrate.yahtzee}</p>
      <p className="celebration-sub">
        {theme === 'voetbal' ? nl.celebrate.goal : nl.celebrate.sweets}
      </p>
      {!calm && <p className="celebration-skip">{nl.celebrate.skip}</p>}
    </div>
  );
}
