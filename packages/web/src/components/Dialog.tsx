import { useEffect, useId, type ReactNode } from 'react';

interface Props {
  title: string;
  children?: ReactNode;
  /** The buttons at the bottom. */
  actions: ReactNode;
  onClose: () => void;
}

/** A simple modal: a dark backdrop with a card in the middle. Escape closes it. */
export function Dialog({ title, children, actions, onClose }: Props) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="backdrop" onClick={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId}>{title}</h2>
        {children}
        <div className="dialog-actions">{actions}</div>
      </div>
    </div>
  );
}
