import type { ReactNode } from 'react';

/** Small line icons used in the mockups. They inherit the text colour. */

interface Props {
  size?: number | undefined;
}

function Svg({ size = 24, children }: Props & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function SpeakerIcon({ on, size }: Props & { on: boolean }) {
  return (
    <Svg size={size}>
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      {on ? (
        <>
          <path d="M16 9.5a3.5 3.5 0 0 1 0 5" />
          <path d="M18.5 7a7 7 0 0 1 0 10" />
        </>
      ) : (
        <>
          <path d="M16.5 9.5l5 5" />
          <path d="M21.5 9.5l-5 5" />
        </>
      )}
    </Svg>
  );
}

export function MenuIcon({ size }: Props) {
  return (
    <Svg size={size}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  );
}

export function BackIcon({ size }: Props) {
  return (
    <Svg size={size}>
      <path d="M15 5l-7 7 7 7" />
    </Svg>
  );
}

export function CheckIcon({ size }: Props) {
  return (
    <Svg size={size}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Svg>
  );
}

/** The app logo: a dark die showing two. */
export function Logo({ size = 44 }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden="true">
      <rect width="44" height="44" rx="11" fill="#1f2430" />
      <circle cx="14" cy="14" r="4.5" fill="#fff" />
      <circle cx="30" cy="30" r="4.5" fill="#fff" />
    </svg>
  );
}
