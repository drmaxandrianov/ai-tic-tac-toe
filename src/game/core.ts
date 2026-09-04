export type Player = 1 | 2; // 1 = ПИЛОТ (человек), 2 = ВЕКТОР-9 (ИИ)
export type Winner = 0 | 1 | 2 | 3; // 0 — нет, 3 — ничья
export type Difficulty = 'easy' | 'normal' | 'hard';
export type BoardSize = 10 | 20 | 30;

export const PLAYER_HUMAN: Player = 1;
export const PLAYER_AI: Player = 2;

export const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

export interface MoveRec {
  idx: number;
  player: Player;
}

export function idxOf(size: number, r: number, c: number): number {
  return r * size + c;
}

/** Возвращает список клеток выигрышной линии (>=5 подряд через idx) или []. */
export function checkWin(b: Uint8Array, size: number, idx: number): number[] {
  const me = b[idx];
  if (me === 0) return [];
  const r = Math.floor(idx / size);
  const c = idx % size;
  for (const [dr, dc] of DIRS) {
    const cells: number[] = [idx];
    for (const sgn of [1, -1]) {
      let rr = r + dr * sgn;
      let cc = c + dc * sgn;
      while (rr >= 0 && rr < size && cc >= 0 && cc < size && b[rr * size + cc] === me) {
        cells.push(rr * size + cc);
        rr += dr * sgn;
        cc += dc * sgn;
      }
    }
    if (cells.length >= 5) return cells;
  }
  return [];
}

export function isBoardFull(b: Uint8Array): boolean {
  for (let i = 0; i < b.length; i++) if (b[i] === 0) return false;
  return true;
}

/** «H8» — буква колонки (до 26) + номер строки. */
export function coordLabel(size: number, idx: number): string {
  const r = Math.floor(idx / size);
  const c = idx % size;
  const col = c < 26 ? String.fromCharCode(65 + c) : String(c + 1);
  return `${col}${r + 1}`;
}

export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const HUMAN_NAME = 'ПИЛОТ';
export const AI_NAME = 'ВЕКТОР-9';

export const DIFF_LABEL: Record<Difficulty, string> = {
  easy: 'НОВИЧОК',
  normal: 'ТАКТИК',
  hard: 'НЕЙРО-МАСТЕР',
};
