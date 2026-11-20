import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { networkInterfaces, type NetworkInterfaceInfo } from 'node:os';
import type { JoinAddress, NetworkKind } from './protocol.js';

type Interfaces = NodeJS.Dict<NetworkInterfaceInfo[]>;

/** Home networks use these ranges; anything else is not reachable from a phone at home. */
function isPrivate(address: string): boolean {
  const [a, b] = address.split('.').map(Number) as [number, number];
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** VPNs, virtual machines, containers and Apple's own peer-to-peer links. */
const VIRTUAL =
  /^(utun|tun|tap|ppp|ipsec|gif|stf|awdl|llw|anpi|bridge|vmnet|vboxnet|virbr|docker|br-|veth|zt|tailscale|wg)|virtual|vmware|vbox|hyper-v|vethernet|vpn|loopback/i;
const WIFI = /^(wl|wlan)|wi-?fi|wireless/i;

/** Wi-Fi first, then cable, then everything else. */
const RANK: Record<NetworkKind, number> = { wifi: 0, cable: 1, other: 2 };

/**
 * The addresses a phone could use to reach this laptop, best first. `wifi` names the
 * interfaces the system knows are Wi-Fi (see `findWifiInterfaces`); names are guessed
 * when it does not know.
 */
export function joinAddresses(
  port: number,
  wifi: ReadonlySet<string> = new Set(),
  interfaces: Interfaces = networkInterfaces(),
): JoinAddress[] {
  const found: JoinAddress[] = [];
  for (const [name, infos] of Object.entries(interfaces)) {
    for (const info of infos ?? []) {
      if (info.family !== 'IPv4' || info.internal || !isPrivate(info.address)) continue;
      const kind: NetworkKind = wifi.has(name)
        ? 'wifi'
        : VIRTUAL.test(name)
          ? 'other'
          : WIFI.test(name)
            ? 'wifi'
            : 'cable';
      found.push({
        name,
        kind,
        address: info.address,
        url: `http://${info.address}:${port}/speler`,
      });
    }
  }
  return found.sort((a, b) => RANK[a.kind] - RANK[b.kind]);
}

/**
 * Asks the system which network interfaces are Wi-Fi. On a Mac `networksetup` knows
 * (Wi-Fi is usually en0, but not always); on Linux the kernel marks wireless devices.
 * Elsewhere, or when that fails, the names are guessed by `joinAddresses`.
 */
export function findWifiInterfaces(platform = process.platform): Promise<Set<string>> {
  if (platform === 'linux') {
    const names = Object.keys(networkInterfaces()).filter((name) =>
      existsSync(`/sys/class/net/${name}/wireless`),
    );
    return Promise.resolve(new Set(names));
  }
  if (platform !== 'darwin') return Promise.resolve(new Set());
  return new Promise((resolve) => {
    execFile('networksetup', ['-listallhardwareports'], { timeout: 3000 }, (error, stdout) => {
      resolve(error ? new Set() : parseHardwarePorts(stdout));
    });
  });
}

/** Reads the Wi-Fi devices from `networksetup -listallhardwareports`. */
export function parseHardwarePorts(output: string): Set<string> {
  const wifi = new Set<string>();
  for (const block of output.split(/\n\s*\n/)) {
    const port = /Hardware Port: (.+)/.exec(block)?.[1];
    const device = /Device: (\S+)/.exec(block)?.[1];
    if (port && device && /wi-?fi|airport/i.test(port)) wifi.add(device);
  }
  return wifi;
}
