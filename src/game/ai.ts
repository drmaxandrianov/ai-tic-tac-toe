/*
 * НЕЙРО-ИИ «ВЕКТОР-9»: эвристический поиск с оценкой угроз по шаблонам
 * (пятёрка, открытая четвёрка, четвёрка, живая тройка ...) + двухходовое
 * предвидение: «мой ход → лучшая контр-угроза соперника».
 */
import type { Difficulty } from './core';
import { DIRS, PLAYER_AI, PLAYER_HUMAN } from './core';

const SCORE_FIVE = 10_000_000;
const SCORE_OPEN_FOUR = 1_000_000;
const SCORE_FOUR = 230_000;
const SCORE_LIVE_THREE = 52_000;
const SCORE_THREE = 2_600;
const SCORE_LIVE_TWO = 700;
const SCORE_TWO = 160;
const SCORE_ONE = 30;

const RE_OPEN_FOUR = /011110/;
const RE_FOUR = /11110|01111|10111|11011|11101/;
const RE_LIVE_THREE = /001110|011100|010110|011010/;
const RE_LIVE_TWO = /00110|01100|01010|001010|010010/;

/** Строка из 9 клеток вдоль направления с центром в (r,c): '1' — свой, '2' — чужой, '0' — пусто, '#' — край. */
function lineStr(b: Uint8Array, size: number, r: number, c: number, dr: number, dc: number, me: number): string {
  let s = '';
  for (let i = -4; i <= 4; i++) {
    if (i === 0) {
      s += '1';
      continue;
    }
    const rr = r + dr * i;
    const cc = c + dc * i;
    if (rr < 0 || rr >= size || cc < 0 || cc >= size) {
      s += '#';
      continue;
    }
    const v = b[rr * size + cc];
    s += v === 0 ? '0' : v === me ? '1' : '2';
  }
  return s;
}

/** Оценка точки: суммарная сила всех 4 направлений, если `me` поставит камень в (r,c). */
function pointScore(b: Uint8Array, size: number, r: number, c: number, me: number): number {
  let total = 0;
  for (const [dr, dc] of DIRS) {
    const s = lineStr(b, size, r, c, dr, dc, me);
    if (s.includes('11111')) total += SCORE_FIVE;
    else if (RE_OPEN_FOUR.test(s)) total += SCORE_OPEN_FOUR;
    else if (RE_FOUR.test(s)) total += SCORE_FOUR;
    else if (RE_LIVE_THREE.test(s)) total += SCORE_LIVE_THREE;
    else if (s.includes('111')) total += SCORE_THREE;
    else if (RE_LIVE_TWO.test(s)) total += SCORE_LIVE_TWO;
    else if (s.includes('11')) total += SCORE_TWO;
    else total += SCORE_ONE;
  }
  return total;
}

/** Кандидаты: пустые клетки в радиусе 2 от любого камня. */
function genCandidates(b: Uint8Array, size: number): number[] {
  const out: number[] = [];
  const seen = new Uint8Array(size * size);
  const R = 2;
  for (let i = 0; i < size * size; i++) {
    if (b[i] === 0) continue;
    const r = Math.floor(i / size);
    const c = i % size;
    for (let dr = -R; dr <= R; dr++) {
      for (let dc = -R; dc <= R; dc++) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const j = rr * size + cc;
        if (b[j] === 0 && !seen[j]) {
          seen[j] = 1;
          out.push(j);
        }
      }
    }
  }
  return out;
}

function countStones(b: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < b.length; i++) if (b[i] !== 0) n++;
  return n;
}

interface Scored {
  idx: number;
  s: number;
  atk: number;
  def: number;
}

export function findBestMove(board: Uint8Array, size: number, diff: Difficulty): number {
  const b = board; // мутируем временно и откатываем
  const center = Math.floor(size / 2) * size + Math.floor(size / 2);

  if (countStones(b) === 0) return center;

  let cands = genCandidates(b, size);
  if (cands.length === 0) return center;
  if (cands.length === 1) return cands[0];

  const mid = (size - 1) / 2;
  const scored: Scored[] = cands.map((idx) => {
    const r = Math.floor(idx / size);
    const c = idx % size;
    const atk = pointScore(b, size, r, c, PLAYER_AI);
    const def = pointScore(b, size, r, c, PLAYER_HUMAN);
    const dist = Math.hypot(r - mid, c - mid);
    const cent = (size * 0.75 - dist) * 4;
    return { idx, atk, def, s: atk + def * 0.9 + cent + Math.random() * 60 };
  });

  // 1) Немедленный выигрыш
  const winMove = scored.find((m) => m.atk >= SCORE_FIVE);
  if (winMove) return winMove.idx;

  // 2) Обязательная блокада пятёрки соперника
  const blocks = scored.filter((m) => m.def >= SCORE_FIVE);
  if (blocks.length > 0) {
    blocks.sort((x, y) => y.s - x.s);
    return blocks[0].idx;
  }

  scored.sort((x, y) => y.s - x.s);

  if (diff === 'easy') {
    // Новичок: обычно берёт лучший ход, но иногда «зекает».
    const pool = scored.slice(0, Math.min(4, scored.length));
    const roll = Math.random();
    if (roll < 0.5 || pool.length === 1) return pool[0].idx;
    return pool[1 + Math.floor(Math.random() * (pool.length - 1))].idx;
  }

  // 3) Двухходовое предвидение: штраф за лучшую контр-угрозу соперника.
  const K = diff === 'hard' ? 10 : 6;
  const top = scored.slice(0, Math.min(K, scored.length));
  const defWeight = diff === 'hard' ? 0.9 : 0.85;
  let best = top[0];
  let bestVal = -Infinity;

  for (const m of top) {
    b[m.idx] = PLAYER_AI;
    let oppBest = 0;
    const replies = genCandidates(b, size);
    for (const j of replies) {
      const rr = Math.floor(j / size);
      const cc = j % size;
      const oAtk = pointScore(b, size, rr, cc, PLAYER_HUMAN);
      if (oAtk >= SCORE_FIVE) {
        oppBest = SCORE_FIVE;
        break;
      }
      const oDef = pointScore(b, size, rr, cc, PLAYER_AI);
      const v = oAtk + oDef * 0.4;
      if (v > oppBest) oppBest = v;
    }
    b[m.idx] = 0;
    const val = m.atk + m.def * defWeight - oppBest * 0.62 + Math.random() * 20;
    if (val > bestVal) {
      bestVal = val;
      best = m;
    }
  }
  return best.idx;
}
