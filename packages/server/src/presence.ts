/**
 * Which phones are connected right now, by seat token. A phone can have several tabs open,
 * so a token is online while at least one of its sockets is connected.
 */
export class Presence {
  readonly #sockets = new Map<string, number>();
  readonly #offlineSince = new Map<string, string>();

  constructor(private readonly now: () => Date = () => new Date()) {}

  connect(token: string): void {
    this.#sockets.set(token, (this.#sockets.get(token) ?? 0) + 1);
    this.#offlineSince.delete(token);
  }

  disconnect(token: string): void {
    const left = (this.#sockets.get(token) ?? 0) - 1;
    if (left > 0) {
      this.#sockets.set(token, left);
      return;
    }
    this.#sockets.delete(token);
    this.#offlineSince.set(token, this.now().toISOString());
  }

  isOnline(token: string): boolean {
    return this.#sockets.has(token);
  }

  /**
   * ISO time in UTC since the token went offline, or null while it is online.
   * A token that never connected has been offline forever.
   */
  offlineSince(token: string): string | null {
    if (this.isOnline(token)) return null;
    return this.#offlineSince.get(token) ?? new Date(0).toISOString();
  }
}
