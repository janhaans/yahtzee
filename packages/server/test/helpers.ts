import { allowedBoxes, type DieValue, type Rng } from '@yahtzee/game-logic';
import { openDatabase } from '../src/history/db.js';
import { HistoryStore, type GameHistory } from '../src/history/store.js';
import { GameRoom } from '../src/room.js';

/** Rng that always rolls the same face. */
export function always(face: DieValue): Rng {
  return () => (face - 1) / 6 + 0.01;
}

export function memoryHistory(): HistoryStore {
  return new HistoryStore(openDatabase(':memory:'));
}

/** A clock that moves one minute forward every time it is read. */
export function ticking(start = '2026-11-19T18:00:00.000Z'): () => Date {
  let time = Date.parse(start);
  return () => {
    const now = new Date(time);
    time += 60_000;
    return now;
  };
}

/** A history whose saves can be made to fail, to test the retry. */
export class FlakyHistory implements GameHistory {
  failing = false;
  constructor(readonly inner: HistoryStore = memoryHistory()) {}
  save: GameHistory['save'] = (record) => {
    if (this.failing) throw new Error('disk full');
    this.inner.save(record);
  };
  findUnfinished: GameHistory['findUnfinished'] = () => this.inner.findUnfinished();
}

/** Ids are unique over all rooms, like real UUIDs, so a restarted room never reuses one. */
let lastId = 0;

export function newRoom(
  history: GameHistory = memoryHistory(),
  rng: Rng = Math.random,
  now: () => Date = ticking(),
): GameRoom {
  return new GameRoom(rng, { history, now, newId: () => `id${++lastId}`, log: () => {} });
}

/** Plays one turn: roll once and take the first allowed box. */
export function playTurn(room: GameRoom): void {
  if (!room.roll().ok) throw new Error('roll failed');
  const state = room.state!;
  const box = allowedBoxes(state.dice!, state.scorecards[state.currentPlayerIndex]!)[0]!;
  if (!room.chooseBox(box).ok) throw new Error('chooseBox failed');
}
