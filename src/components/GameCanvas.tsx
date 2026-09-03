import { useEffect, useRef } from 'react';
import type { Winner } from '../game/core';

interface Props {
  size: number;
  board: Uint8Array;
  turn: number;
  winner: Winner;
  winLine: number[];
  lastMove: number;
  onCellClick: (idx: number) => void;
  onInvalidClick: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  col: string;
  sz: number;
}

interface Ring {
  x: number;
  y: number;
  t0: number;
  col: string;
  max: number;
}

const CYAN = '#00e5ff';
const MAGENTA = '#ff2e7e';
const GOLD = '#ffd166';

function easeOutBack(p: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const q = p - 1;
  return 1 + c3 * q * q * q + c1 * q * q;
}

export default function GameCanvas({
  size,
  board,
  turn,
  winner,
  winLine,
  lastMove,
  onCellClick,
  onInvalidClick,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const propsRef = useRef({ size, board, turn, winner, winLine, lastMove });
  propsRef.current = { size, board, turn, winner, winLine, lastMove };
  const cbRef = useRef({ onCellClick, onInvalidClick });
  cbRef.current = { onCellClick, onInvalidClick };

  const animRef = useRef({
    stones: new Map<number, number>(), // idx -> t0 появления
    particles: [] as Particle[],
    rings: [] as Ring[],
    shake: 0,
    shakeT: 0,
    flash: 0,
    flashCol: '255,209,102',
    hover: -1,
    celebrated: 0 as Winner,
    lastBoard: null as Uint8Array | null,
    dpr: 1,
    w: 0,
    h: 0,
    ox: 0,
    oy: 0,
    cell: 20,
  });

  /* --- реакция на новые камни / победу --- */
  useEffect(() => {
    const A = animRef.current;
    const now = performance.now();
    if (A.lastBoard !== board) {
      const prev = A.lastBoard;
      for (let i = 0; i < board.length; i++) {
        if (board[i] !== 0 && (!prev || prev[i] === 0)) {
          A.stones.set(i, now);
          const r = Math.floor(i / size);
          const c = i % size;
          const { x, y } = cellCenter(A, size, r, c);
          const col = board[i] === 1 ? CYAN : MAGENTA;
          A.rings.push({ x, y, t0: now, col, max: 1 });
          const n = 14;
          for (let k = 0; k < n; k++) {
            const ang = (k / n) * Math.PI * 2 + Math.random() * 0.5;
            const sp = 60 + Math.random() * 130;
            A.particles.push({
              x, y,
              vx: Math.cos(ang) * sp,
              vy: Math.sin(ang) * sp,
              life: 0, maxLife: 0.5 + Math.random() * 0.35,
              col, sz: 1.5 + Math.random() * 2,
            });
          }
          A.shake = Math.max(A.shake, 2.5);
          A.shakeT = now;
        }
      }
      if (prev) {
        for (const key of Array.from(A.stones.keys())) {
          if (board[key] === 0) A.stones.delete(key);
        }
      }
      A.lastBoard = board;
    }
  }, [board, size]);

  useEffect(() => {
    const A = animRef.current;
    const now = performance.now();
    if (winner !== 0 && A.celebrated !== winner) {
      A.celebrated = winner;
      if (winner === 1) {
        A.flash = 1; A.flashCol = '0,229,255';
        A.shake = 10; A.shakeT = now;
      } else if (winner === 2) {
        A.flash = 1; A.flashCol = '255,46,126';
        A.shake = 8; A.shakeT = now;
      } else {
        A.flash = 0.6; A.flashCol = '160,190,220';
      }
      winLine.forEach((idx, k) => {
        const r = Math.floor(idx / size);
        const c = idx % size;
        const { x, y } = cellCenter(A, size, r, c);
        A.rings.push({ x, y, t0: now + k * 60, col: GOLD, max: 1.6 });
        const col = winner === 2 ? MAGENTA : winner === 1 ? CYAN : '#b8d4e8';
        for (let i = 0; i < 22; i++) {
          const ang = Math.random() * Math.PI * 2;
          const sp = 40 + Math.random() * 220;
          A.particles.push({
            x, y,
            vx: Math.cos(ang) * sp,
            vy: Math.sin(ang) * sp - 60,
            life: 0, maxLife: 0.7 + Math.random() * 0.7,
            col: i % 3 === 0 ? GOLD : col,
            sz: 1.5 + Math.random() * 2.6,
          });
        }
      });
    }
    if (winner === 0) A.celebrated = 0;
  }, [winner, winLine, size]);

  /* --- главный цикл отрисовки --- */
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const A = animRef.current;
    A.stones.clear();
    A.lastBoard = null;
    A.celebrated = 0;
    // пересинхронизация существующих камней без анимации
    const b0 = propsRef.current.board;
    for (let i = 0; i < b0.length; i++) if (b0[i] !== 0) A.stones.set(i, -1e9);
    A.lastBoard = b0;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      A.dpr = Math.min(2, window.devicePixelRatio || 1);
      A.w = rect.width;
      A.h = rect.height;
      canvas.width = Math.max(1, Math.round(rect.width * A.dpr));
      canvas.height = Math.max(1, Math.round(rect.height * A.dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let raf = 0;
    let last = performance.now();

    const draw = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const P = propsRef.current;
      const { w, h, dpr } = A;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const n = P.size;
      const pad = Math.max(18, Math.min(w, h) * 0.045);
      const cell = (Math.min(w, h) - pad * 2) / (n - 1);
      const ox = (w - cell * (n - 1)) / 2;
      const oy = (h - cell * (n - 1)) / 2;
      A.ox = ox; A.oy = oy; A.cell = cell;

      // тряска
      if (A.shake > 0.1) {
        const k = A.shake * Math.exp(-(t - A.shakeT) / 180);
        ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
        if (t - A.shakeT > 900) A.shake = 0;
      }

      // подложка поля
      const bx = ox - cell * 0.75;
      const by = oy - cell * 0.75;
      const bs = cell * (n - 1) + cell * 1.5;
      const bgGrad = ctx.createLinearGradient(bx, by, bx, by + bs);
      bgGrad.addColorStop(0, 'rgba(13,31,63,0.72)');
      bgGrad.addColorStop(1, 'rgba(6,13,28,0.85)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(bx, by, bs, bs);
      ctx.strokeStyle = 'rgba(0,229,255,0.28)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, by, bs, bs);
      ctx.strokeStyle = 'rgba(0,229,255,0.08)';
      ctx.lineWidth = 6;
      ctx.strokeRect(bx - 3, by - 3, bs + 6, bs + 6);

      // уголки-скобки рамки
      ctx.strokeStyle = 'rgba(0,229,255,0.85)';
      ctx.lineWidth = 2.5;
      const L = Math.min(26, bs * 0.08);
      const corners: Array<[number, number, number, number]> = [
        [bx, by, 1, 1], [bx + bs, by, -1, 1], [bx, by + bs, 1, -1], [bx + bs, by + bs, -1, -1],
      ];
      for (const [cx2, cy2, sx, sy] of corners) {
        ctx.beginPath();
        ctx.moveTo(cx2 + sx * L, cy2);
        ctx.lineTo(cx2, cy2);
        ctx.lineTo(cx2, cy2 + sy * L);
        ctx.stroke();
      }

      // сетка (2 прохода: свечение + линия)
      for (const pass of [0, 1]) {
        for (let i = 0; i < n; i++) {
          const major = n >= 15 ? i % 5 === 0 : i % 2 === 0;
          const a = pass === 0 ? (major ? 0.16 : 0.07) : major ? 0.42 : 0.22;
          ctx.strokeStyle = `rgba(96,205,255,${a})`;
          ctx.lineWidth = pass === 0 ? 2.6 : 1;
          ctx.beginPath();
          ctx.moveTo(ox + i * cell, oy);
          ctx.lineTo(ox + i * cell, oy + cell * (n - 1));
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(ox, oy + i * cell);
          ctx.lineTo(ox + cell * (n - 1), oy + i * cell);
          ctx.stroke();
        }
      }

      // опорные узлы
      if (n >= 15) {
        const f = Math.round((n - 1) / 4);
        const pts = [f, Math.floor((n - 1) / 2), n - 1 - f];
        ctx.fillStyle = 'rgba(0,229,255,0.5)';
        for (const pr of pts) {
          for (const pc of pts) {
            ctx.beginPath();
            ctx.arc(ox + pc * cell, oy + pr * cell, Math.max(1.6, cell * 0.09), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else {
        ctx.fillStyle = 'rgba(0,229,255,0.5)';
        const m = (n - 1) / 2;
        ctx.beginPath();
        ctx.arc(ox + m * cell, oy + m * cell, Math.max(1.6, cell * 0.09), 0, Math.PI * 2);
        ctx.fill();
      }

      // луч через выигрышную линию
      if (P.winLine.length >= 5) {
        const cellsL = P.winLine
          .map((idx) => [idx % n, Math.floor(idx / n)] as const)
          .sort((p, q) => p[0] - q[0] || p[1] - q[1]);
        const a0 = cellsL[0];
        const a1 = cellsL[cellsL.length - 1];
        const pulse = 0.4 + 0.25 * Math.sin(t / 180);
        ctx.strokeStyle = `rgba(255,209,102,${pulse})`;
        ctx.lineWidth = cell * 0.3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ox + a0[0] * cell, oy + a0[1] * cell);
        ctx.lineTo(ox + a1[0] * cell, oy + a1[1] * cell);
        ctx.stroke();
        ctx.lineCap = 'butt';
      }

      // камни
      const winSet = new Set(P.winLine);
      const R = cell * 0.42;
      for (const [idx, t0] of A.stones) {
        const v = P.board[idx];
        if (v === 0) continue;
        const r = Math.floor(idx / n);
        const c = idx % n;
        const x = ox + c * cell;
        const y = oy + r * cell;
        const p = t0 < 0 ? 1 : Math.min(1, (t - t0) / 260);
        const rad = R * Math.max(0.01, easeOutBack(p));
        const col = v === 1 ? CYAN : MAGENTA;

        // свечение
        const glow = ctx.createRadialGradient(x, y, rad * 0.2, x, y, rad * 2.1);
        glow.addColorStop(0, v === 1 ? 'rgba(0,229,255,0.30)' : 'rgba(255,46,126,0.30)');
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, rad * 2.1, 0, Math.PI * 2);
        ctx.fill();

        // корпус
        const body = ctx.createRadialGradient(x - rad * 0.35, y - rad * 0.35, rad * 0.1, x, y, rad);
        if (v === 1) {
          body.addColorStop(0, '#eaffff');
          body.addColorStop(0.35, '#8df2ff');
          body.addColorStop(0.75, '#00c3e0');
          body.addColorStop(1, '#005e80');
        } else {
          body.addColorStop(0, '#fff0f6');
          body.addColorStop(0.35, '#ff9ec4');
          body.addColorStop(0.75, '#f5247a');
          body.addColorStop(1, '#7a0f3d');
        }
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = v === 1 ? 'rgba(180,250,255,0.9)' : 'rgba(255,190,215,0.9)';
        ctx.lineWidth = Math.max(0.8, cell * 0.035);
        ctx.stroke();

        // символ-керн: X у пилота, квадрат-ядро у ИИ
        ctx.strokeStyle = 'rgba(4,10,22,0.55)';
        ctx.lineWidth = Math.max(1, rad * 0.22);
        ctx.lineCap = 'round';
        if (v === 1) {
          const k = rad * 0.42;
          ctx.beginPath();
          ctx.moveTo(x - k, y - k); ctx.lineTo(x + k, y + k);
          ctx.moveTo(x + k, y - k); ctx.lineTo(x - k, y + k);
          ctx.stroke();
        } else {
          const k = rad * 0.36;
          ctx.beginPath();
          ctx.arc(x, y, k, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.lineCap = 'butt';

        // пульс победной линии
        if (winSet.has(idx)) {
          const wp = 0.5 + 0.5 * Math.sin(t / 140 + idx);
          ctx.strokeStyle = `rgba(255,209,102,${0.45 + 0.5 * wp})`;
          ctx.lineWidth = Math.max(1.2, cell * 0.07);
          ctx.beginPath();
          ctx.arc(x, y, rad + cell * 0.1 + wp * cell * 0.05, 0, Math.PI * 2);
          ctx.stroke();
        }

        // маркер последнего хода — вращающийся ромб
        if (idx === P.lastMove && P.winner === 0) {
          const rot = t / 700;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(rot);
          ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.3 * Math.sin(t / 200)})`;
          ctx.lineWidth = Math.max(1, cell * 0.05);
          const k = rad + cell * 0.16;
          ctx.strokeRect(-k * 0.72, -k * 0.72, k * 1.44, k * 1.44);
          ctx.restore();
        }
      }

      // призрак при наведении
      if (
        A.hover >= 0 &&
        P.turn === 1 &&
        P.winner === 0 &&
        P.board[A.hover] === 0
      ) {
        const r = Math.floor(A.hover / n);
        const c = A.hover % n;
        const x = ox + c * cell;
        const y = oy + r * cell;
        ctx.fillStyle = 'rgba(0,229,255,0.13)';
        ctx.beginPath();
        ctx.arc(x, y, R, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,229,255,0.65)';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([cell * 0.14, cell * 0.1]);
        ctx.lineDashOffset = -t / 40;
        ctx.beginPath();
        ctx.arc(x, y, R, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        // перекрестие
        ctx.strokeStyle = 'rgba(0,229,255,0.4)';
        ctx.beginPath();
        ctx.moveTo(x - cell * 0.75, y); ctx.lineTo(x - cell * 0.3, y);
        ctx.moveTo(x + cell * 0.3, y); ctx.lineTo(x + cell * 0.75, y);
        ctx.moveTo(x, y - cell * 0.75); ctx.lineTo(x, y - cell * 0.3);
        ctx.moveTo(x, y + cell * 0.3); ctx.lineTo(x, y + cell * 0.75);
        ctx.stroke();
      }

      // кольца
      A.rings = A.rings.filter((rg) => t - rg.t0 < 520);
      for (const rg of A.rings) {
        if (rg.t0 > t) continue;
        const p = (t - rg.t0) / 520;
        ctx.strokeStyle = rg.col;
        ctx.globalAlpha = (1 - p) * 0.8;
        ctx.lineWidth = 2.2 * (1 - p) + 0.4;
        ctx.beginPath();
        ctx.arc(rg.x, rg.y, cell * 0.4 + p * cell * 1.5 * rg.max, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // частицы
      ctx.globalCompositeOperation = 'lighter';
      A.particles = A.particles.filter((pt) => pt.life < pt.maxLife);
      for (const pt of A.particles) {
        pt.life += dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vy += 140 * dt;
        pt.vx *= 0.985;
        const a = Math.max(0, 1 - pt.life / pt.maxLife);
        ctx.globalAlpha = a;
        ctx.fillStyle = pt.col;
        ctx.fillRect(pt.x - pt.sz / 2, pt.y - pt.sz / 2, pt.sz, pt.sz);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      // вспышка
      if (A.flash > 0.01) {
        ctx.fillStyle = `rgba(${A.flashCol},${A.flash * 0.22})`;
        ctx.fillRect(-20, -20, w + 40, h + 40);
        A.flash *= Math.exp(-dt * 2.6);
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    /* --- указатель --- */
    const toCell = (e: PointerEvent): number => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const ox = A.ox;
      const oy = A.oy;
      const cl = A.cell;
      const c = Math.round((x - ox) / cl);
      const r = Math.round((y - oy) / cl);
      const n = propsRef.current.size;
      if (r < 0 || r >= n || c < 0 || c >= n) return -1;
      const dx = x - (ox + c * cl);
      const dy = y - (oy + r * cl);
      if (Math.hypot(dx, dy) > cl * 0.55) return -1;
      return r * n + c;
    };
    const onMove = (e: PointerEvent) => {
      const idx = toCell(e);
      A.hover = idx;
      canvas.style.cursor =
        idx >= 0 && propsRef.current.turn === 1 && propsRef.current.winner === 0
          ? propsRef.current.board[idx] === 0
            ? 'crosshair'
            : 'not-allowed'
          : 'default';
    };
    const onLeave = () => {
      A.hover = -1;
    };
    const onClick = (e: PointerEvent) => {
      const idx = toCell(e);
      if (idx < 0) return;
      if (propsRef.current.board[idx] !== 0 || propsRef.current.turn !== 1 || propsRef.current.winner !== 0) {
        cbRef.current.onInvalidClick();
        return;
      }
      cbRef.current.onCellClick(idx);
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('pointerdown', onClick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointerdown', onClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <canvas ref={canvasRef} className="block touch-none select-none" />
    </div>
  );
}

/* Центры клеток для эффектов (используется до первого кадра — расчёт по последним данным). */
function cellCenter(
  A: { w: number; h: number } & Record<string, unknown>,
  size: number,
  r: number,
  c: number,
): { x: number; y: number } {
  const w = A.w || 600;
  const h = A.h || 600;
  const pad = Math.max(18, Math.min(w, h) * 0.045);
  const cell = (Math.min(w, h) - pad * 2) / (size - 1);
  const ox = (w - cell * (size - 1)) / 2;
  const oy = (h - cell * (size - 1)) / 2;
  return { x: ox + c * cell, y: oy + r * cell };
}
