import { useMemo } from 'react';
import { create } from 'qrcode';

/** Quiet zone around the code, in modules, so phone cameras find its edges. */
const MARGIN = 2;

/**
 * A QR code as a crisp SVG, made in the browser: no internet needed. Always dark on white,
 * whatever the theme, because that is what phone cameras read best.
 */
export function QrCode({ text, label }: { text: string; label: string }) {
  const { size, path } = useMemo(() => {
    const { modules } = create(text, { errorCorrectionLevel: 'M' });
    let path = '';
    for (let row = 0; row < modules.size; row++) {
      for (let col = 0; col < modules.size; col++) {
        if (modules.get(row, col)) path += `M${col} ${row}h1v1h-1z`;
      }
    }
    return { size: modules.size, path };
  }, [text]);
  const full = size + 2 * MARGIN;

  return (
    <svg
      className="qr-code"
      role="img"
      aria-label={label}
      viewBox={`${-MARGIN} ${-MARGIN} ${full} ${full}`}
      shapeRendering="crispEdges"
    >
      <rect x={-MARGIN} y={-MARGIN} width={full} height={full} fill="#fff" />
      <path d={path} fill="#111" />
    </svg>
  );
}
