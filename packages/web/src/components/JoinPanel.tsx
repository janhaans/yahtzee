import { useState } from 'react';
import { nl } from '../i18n/nl';
import { pickAddress, useJoinAddresses } from '../join';
import { useJoinChoice } from '../settings';
import { Dialog } from './Dialog';
import { QrCode } from './QrCode';

/**
 * "Scan mij en doe mee!": the QR code with the laptop's address, and that address as text
 * for typing it in by hand. When the laptop has several addresses (Wi-Fi, cable, VPN...),
 * another one can be picked; this laptop remembers the choice.
 */
export function JoinPanel() {
  const addresses = useJoinAddresses();
  const [chosen, setChosen] = useJoinChoice();
  const [picking, setPicking] = useState(false);

  if (addresses === undefined) {
    return (
      <section className="join-panel card" aria-label={nl.join.title}>
        <p className="hint">{nl.join.loading}</p>
      </section>
    );
  }

  const current = pickAddress(addresses, chosen);
  if (current === null) {
    return (
      <section className="join-panel card" aria-label={nl.join.title}>
        <p className="join-none">{nl.join.noNetwork}</p>
      </section>
    );
  }

  return (
    <section className="join-panel card" aria-label={nl.join.title}>
      <h2>{nl.join.title}</h2>
      <QrCode text={current.url} label={nl.join.qrLabel(current.url)} />
      {/* Without http:// it fits on one line, and phones find it just as well when typed. */}
      <p className="join-url">{current.url.replace(/^https?:\/\//, '')}</p>
      <p className="hint">{nl.join.sameWifi}</p>
      {addresses.length > 1 && (
        <button type="button" className="button soft" onClick={() => setPicking(true)}>
          {nl.join.otherAddress}
        </button>
      )}

      {picking && (
        <Dialog
          title={nl.join.chooseTitle}
          onClose={() => setPicking(false)}
          actions={
            <button type="button" className="button" onClick={() => setPicking(false)}>
              {nl.confirm.close}
            </button>
          }
        >
          <div className="address-list" role="radiogroup" aria-label={nl.join.chooseTitle}>
            {addresses.map((a) => (
              <button
                key={`${a.name}-${a.address}`}
                type="button"
                role="radio"
                aria-checked={a === current}
                className="address-choice"
                onClick={() => {
                  setChosen(a.address);
                  setPicking(false);
                }}
              >
                <strong>{a.address}</strong>
                <span className="hint">
                  {nl.join.kinds[a.kind]} · {a.name}
                </span>
              </button>
            ))}
          </div>
        </Dialog>
      )}
    </section>
  );
}
