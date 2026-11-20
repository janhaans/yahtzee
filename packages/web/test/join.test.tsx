// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JoinAddress } from '@yahtzee/server/protocol';
import { JoinPanel } from '../src/components/JoinPanel';
import { QrCode } from '../src/components/QrCode';
import { fetchJoinAddresses, pickAddress } from '../src/join';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const wifi: JoinAddress = {
  name: 'en0',
  kind: 'wifi',
  address: '192.168.1.20',
  url: 'http://192.168.1.20:3000/speler',
};
const vpn: JoinAddress = {
  name: 'utun4',
  kind: 'other',
  address: '10.8.0.2',
  url: 'http://10.8.0.2:3000/speler',
};

function serve(addresses: JoinAddress[] | 'down') {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      addresses === 'down'
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(new Response(JSON.stringify({ addresses }))),
    ),
  );
}

describe('join addresses', () => {
  it('picks the address chosen by hand while it exists, otherwise the best one', () => {
    expect(pickAddress([wifi, vpn], '')).toBe(wifi);
    expect(pickAddress([wifi, vpn], '10.8.0.2')).toBe(vpn);
    expect(pickAddress([wifi], '10.8.0.2')).toBe(wifi);
    expect(pickAddress([], '')).toBeNull();
  });

  it('asks the server, and has none when it cannot answer', async () => {
    serve([wifi]);
    expect(await fetchJoinAddresses()).toEqual([wifi]);
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('', { status: 500 })));
    expect(await fetchJoinAddresses()).toEqual([]);
    serve('down');
    expect(await fetchJoinAddresses()).toEqual([]);
  });
});

describe('JoinPanel', () => {
  it('shows the QR code with the Wi-Fi address as text under it', async () => {
    serve([wifi]);
    render(<JoinPanel />);
    expect(await screen.findByRole('heading', { name: 'Scan mij en doe mee!' })).toBeVisible();
    expect(screen.getByRole('img', { name: /192\.168\.1\.20:3000\/speler/ })).toBeVisible();
    expect(screen.getByText('192.168.1.20:3000/speler')).toBeVisible();
    // With one address there is nothing to choose.
    expect(screen.queryByRole('button', { name: 'Ander adres kiezen' })).toBeNull();
  });

  it('lets the laptop pick another address and remembers it', async () => {
    serve([wifi, vpn]);
    const { unmount } = render(<JoinPanel />);
    await userEvent.click(await screen.findByRole('button', { name: 'Ander adres kiezen' }));
    const choice = screen.getByRole('radio', { name: /10\.8\.0\.2/ });
    expect(choice).toHaveTextContent('Anders (VPN of virtueel) · utun4');
    expect(screen.getByRole('radio', { name: /192\.168\.1\.20/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await userEvent.click(choice);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('10.8.0.2:3000/speler')).toBeVisible();

    unmount();
    render(<JoinPanel />);
    expect(await screen.findByText('10.8.0.2:3000/speler')).toBeVisible();
  });

  it('closes the address list without a change', async () => {
    serve([wifi, vpn]);
    render(<JoinPanel />);
    await userEvent.click(await screen.findByRole('button', { name: 'Ander adres kiezen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sluiten' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('192.168.1.20:3000/speler')).toBeVisible();
  });

  it('says kindly that phones cannot join without a network', async () => {
    serve([]);
    render(<JoinPanel />);
    expect(await screen.findByText(/Spelen op de laptop kan altijd!/)).toBeVisible();
    expect(screen.queryByRole('img')).toBeNull();
  });
});

describe('QrCode', () => {
  it('draws dark squares on white with a quiet zone', () => {
    render(<QrCode text="http://192.168.1.20:3000/speler" label="QR" />);
    const svg = screen.getByRole('img', { name: 'QR' });
    // Version 3 (29 x 29 modules) plus 2 modules of quiet zone on every side.
    expect(svg).toHaveAttribute('viewBox', '-2 -2 33 33');
    expect(svg.querySelector('path')!.getAttribute('d')).toMatch(/^M0 0h1v1h-1z/);
  });
});
