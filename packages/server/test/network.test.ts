import type { NetworkInterfaceInfo } from 'node:os';
import { describe, expect, it } from 'vitest';
import { findWifiInterfaces, joinAddresses, parseHardwarePorts } from '../src/network.js';

function ipv4(address: string, internal = false): NetworkInterfaceInfo {
  return {
    address,
    netmask: '255.255.255.0',
    family: 'IPv4',
    mac: '00:00:00:00:00:00',
    internal,
    cidr: `${address}/24`,
  };
}

describe('joinAddresses', () => {
  it('lists private IPv4 addresses with Wi-Fi first, then cable, then virtual ones', () => {
    const found = joinAddresses(3000, new Set(['en0']), {
      lo0: [ipv4('127.0.0.1', true)],
      bridge100: [ipv4('192.168.64.1')],
      utun4: [ipv4('10.8.0.2')],
      en5: [ipv4('172.20.1.4')],
      en0: [
        ipv4('192.168.1.20'),
        { ...ipv4('fe80::1'), family: 'IPv6', cidr: 'fe80::1/64', scopeid: 1 },
      ],
      tailscale0: [ipv4('100.101.1.2')],
      eth9: [ipv4('8.8.8.8'), ipv4('172.32.0.1')],
      empty: undefined,
    });
    expect(found.map((a) => [a.name, a.kind, a.url])).toEqual([
      ['en0', 'wifi', 'http://192.168.1.20:3000/speler'],
      ['en5', 'cable', 'http://172.20.1.4:3000/speler'],
      ['bridge100', 'other', 'http://192.168.64.1:3000/speler'],
      ['utun4', 'other', 'http://10.8.0.2:3000/speler'],
    ]);
  });

  it('guesses Wi-Fi from the name when the system does not say', () => {
    const found = joinAddresses(5173, undefined, {
      'Ethernet 2': [ipv4('192.168.1.30')],
      'vEthernet (WSL)': [ipv4('172.24.0.1')],
      'Wi-Fi': [ipv4('192.168.1.31')],
      wlp2s0: [ipv4('10.0.0.5')],
    });
    expect(found.map((a) => [a.name, a.kind])).toEqual([
      ['Wi-Fi', 'wifi'],
      ['wlp2s0', 'wifi'],
      ['Ethernet 2', 'cable'],
      ['vEthernet (WSL)', 'other'],
    ]);
    expect(found[0]!.address).toBe('192.168.1.31');
  });

  it('reads the real interfaces by default', () => {
    expect(Array.isArray(joinAddresses(3000))).toBe(true);
  });
});

describe('Wi-Fi interfaces', () => {
  it('reads them from networksetup on a Mac', () => {
    const output = [
      'Hardware Port: Ethernet Adapter (en3)\nDevice: en3\nEthernet Address: 42:0b',
      'Hardware Port: Thunderbolt Bridge\nDevice: bridge0\nEthernet Address: 36:02',
      'Hardware Port: Wi-Fi\nDevice: en1\nEthernet Address: 74:a6',
      'VLAN Configurations\n===================',
    ].join('\n\n');
    expect(parseHardwarePorts(output)).toEqual(new Set(['en1']));
  });

  it('knows none on other systems, and never fails', async () => {
    expect(await findWifiInterfaces('win32')).toEqual(new Set());
    expect(await findWifiInterfaces('linux')).toBeInstanceOf(Set);
    expect(await findWifiInterfaces(process.platform)).toBeInstanceOf(Set);
  });
});
