import { useCallback, useEffect, useRef, useState } from 'react';
import type { MoveRec, Player, Winner } from '../game/core';
import {
  AI_NAME,
  DIFF_LABEL,
  HUMAN_NAME,
  checkWin,
  coordLabel,
  formatTime,
  isBoardFull,
} from '../game/core';
import { findBestMove } from '../game/ai';
import { sfx } from '../game/audio';
import type { Settings } from './MenuScreen';
import GameCanvas from './GameCanvas';

interface Props {
  settings: Settings;
  muted: boolean;
  onToggleMute: () => void;
  onExit: () => void;
}

interface LogEntry {
  n: number;
  player: Player;
  label: string;
}

const IconUndo = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M8 5 3 10l5 5" />
    <path d="M3 10h11a6 6 0 0 1 0 12h-4" />
  </svg>
);

const IconHome = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10v9h13v-9" />
  </svg>
);

const IconRefresh = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M20 12a8 8 0 1 1-2.3-5.6" />
    <path d="M20 3v4h-4" />
  </svg>
);

const IconSound = ({ muted }: { muted: boolean }) => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none" />
    {muted ? <path d="M16 9l5 6M21 9l-5 6" /> : <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />}
  </svg>
);

export default function GameScreen({ settings, muted, onToggleMute, onExit }: Props) {
  const { size, difficulty, first } = settings;

  const boardRef = useRef<Uint8Array>(new Uint8Array(size * size));
  const [board, setBoard] = useState<Uint8Array>(boardRef.current);
  const [turn, setTurn] = useState<Player>(first);
  const [winner, setWinner] = useState<Winner>(0);
  const [winLine, setWinLine] = useState<number[]>([]);
  const [lastMove, setLastMove] = useState(-1);
  const [hist, setHist] = useState<MoveRec[]>([]);
  const [thinking, setThinking] = useState(false);
  const [score, setScore] = useState({ h: 0, a: 0, d: 0 });
  const [elapsed, setElapsed] = useState(0);
  const [round, setRound] = useState(1);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [toast, setToast] = useState<{ msg: string; key: number } | null>(null);

  const winnerRef = useRef<Winner>(0);
  winnerRef.current = winner;
  const roundRef = useRef(1);
  roundRef.current = round;
  const turnRef = useRef<Player>(first);

  const moveNumRef = useRef(0);
  const pushLog = useCallback((player: Player, label: string) => {
    moveNumRef.current += 1;
    setLog((prev) => [{ n: moveNumRef.current, player, label }, ...prev].slice(0, 7));
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast({ msg, key: Date.now() });
  }, []);

  /* начальный тост */
  useEffect(() => {
    showToast(`РАУНД 1 // ${first === 1 ? 'ВАШ ХОД' : `ХОДИТ ${AI_NAME}`}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyMove = useCallback(
    (idx: number, player: Player) => {
      const nb = new Uint8Array(boardRef.current);
      nb[idx] = player;
      boardRef.current = nb;
      setBoard(nb);
      setLastMove(idx);
      setHist((h) => [...h, { idx, player }]);
      pushLog(player, coordLabel(size, idx));

      const wl = checkWin(nb, size, idx);
      if (wl.length > 0) {
        turnRef.current = player;
        setWinner(player);
        setWinLine(wl);
        setScore((s) => (player === 1 ? { ...s, h: s.h + 1 } : { ...s, a: s.a + 1 }));
        window.setTimeout(() => (player === 1 ? sfx.win() : sfx.lose()), 260);
        return;
      }
      if (isBoardFull(nb)) {
        turnRef.current = player; // ходов больше не будет
        setWinner(3);
        setScore((s) => ({ ...s, d: s.d + 1 }));
        window.setTimeout(() => sfx.draw(), 260);
        return;
      }
      turnRef.current = player === 1 ? 2 : 1;
      setTurn(turnRef.current);
    },
    [pushLog, size],
  );

  /* ход ИИ */
  useEffect(() => {
    if (turn !== 2 || winnerRef.current !== 0) return;
    setThinking(true);
    sfx.think();
    const delay = 550 + Math.random() * 550;
    const t = window.setTimeout(() => {
      const mv = findBestMove(boardRef.current, size, difficulty);
      sfx.aiPlace();
      applyMove(mv, 2);
      setThinking(false);
    }, delay);
    return () => {
      window.clearTimeout(t);
      setThinking(false);
    };
  }, [turn, size, difficulty, applyMove]);

  /* таймер партии */
  useEffect(() => {
    if (winner !== 0) return;
    const iv = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(iv);
  }, [winner, round]);

  const handleCell = useCallback(
    (idx: number) => {
      if (turnRef.current !== 1 || winnerRef.current !== 0 || thinking) return;
      sfx.place();
      applyMove(idx, 1);
    },
    [thinking, applyMove],
  );

  const handleInvalid = useCallback(() => {
    if (winnerRef.current === 0) sfx.invalid();
  }, []);

  const undo = useCallback(() => {
    if (thinking || winnerRef.current !== 0 || turn !== 1) return;
    const h = [...hist];
    if (h.length === 0) return;
    const nb = new Uint8Array(boardRef.current);
    let removedHuman = false;
    while (h.length > 0 && !removedHuman) {
      const m = h.pop() as MoveRec;
      nb[m.idx] = 0;
      if (m.player === 1) removedHuman = true;
    }
    if (!removedHuman) return;
    boardRef.current = nb;
    setBoard(nb);
    setHist(h);
    moveNumRef.current = h.length;
    setLog(
      h
        .map((m, i) => ({ n: i + 1, player: m.player, label: coordLabel(size, m.idx) }))
        .reverse()
        .slice(0, 7),
    );
    setLastMove(h.length > 0 ? h[h.length - 1].idx : -1);
    turnRef.current = 1;
    setTurn(1);
    sfx.undo();
  }, [thinking, turn, hist, size]);

  const newRound = useCallback(() => {
    sfx.click();
    const nb = new Uint8Array(size * size);
    boardRef.current = nb;
    const nextRound = roundRef.current + 1;
    setBoard(nb);
    setHist([]);
    setLog([]);
    moveNumRef.current = 0;
    setWinner(0);
    setWinLine([]);
    setLastMove(-1);
    setElapsed(0);
    setRound(nextRound);
    const f: Player = nextRound % 2 === 1 ? first : first === 1 ? 2 : 1;
    turnRef.current = f;
    setTurn(f);
    showToast(`РАУНД ${nextRound} // ${f === 1 ? 'ВАШ ХОД' : `ХОДИТ ${AI_NAME}`}`);
  }, [size, first, showToast]);

  /* клавиатура */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyZ') undo();
      if (e.code === 'KeyM') onToggleMute();
      if (e.code === 'Escape') onExit();
      if (e.code === 'Enter' && winnerRef.current !== 0) newRound();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, onToggleMute, onExit, newRound]);

  const statusText =
    winner === 1
      ? 'СЕКТОР ЗАХВАЧЕН'
      : winner === 2
        ? 'ЯДРО ПОРАЖЕНО'
        : winner === 3
          ? 'ПАРИТЕТ'
          : turn === 1
            ? 'ВАШ ХОД'
            : 'НЕЙРО-ИИ АНАЛИЗИРУЕТ';

  return (
    <div className="relative z-10 flex h-full flex-col">
      {/* ---------- верхняя панель ---------- */}
      <header className="flex items-center gap-3 border-b border-line/70 bg-abyss/70 px-3 py-2 backdrop-blur-sm sm:px-5">
        <button onClick={() => { sfx.click(); onExit(); }} className="btn-hud flex items-center gap-2" title="В меню (ESC)">
          <svg viewBox="0 0 40 40" className="spin-slow h-6 w-6 text-neon" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="20,2 36,11 36,29 20,38 4,29 4,11" />
          </svg>
          <span className="font-disp text-sm tracking-widest text-white sm:text-base">НЕКСУС-5</span>
        </button>

        <div className="mx-auto flex items-center gap-2.5">
          <span
            className={`blink-dot h-2 w-2 ${
              winner !== 0 ? 'bg-amberx' : turn === 1 ? 'bg-neon' : 'bg-flux'
            }`}
          />
          <span
            className={`font-disp text-[11px] tracking-[0.22em] sm:text-xs ${
              winner === 1 ? 'text-neon' : winner === 2 ? 'text-flux' : winner === 3 ? 'text-amberx' : turn === 1 ? 'text-neon' : 'text-flux'
            }`}
          >
            {statusText}
            {turn === 2 && winner === 0 && <span className="dots" />}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { onToggleMute(); }}
            className={`btn-hud clip-btn border px-2.5 py-1.5 ${muted ? 'border-line text-inkd' : 'border-neon/50 text-neon'}`}
            title="Звук (M)"
          >
            <IconSound muted={muted} />
          </button>
          <button
            onClick={() => { sfx.click(); onExit(); }}
            className="btn-hud clip-btn border border-line px-2.5 py-1.5 text-inkm hover:border-neon/50 hover:text-neon"
            title="В меню (ESC)"
          >
            <IconHome />
          </button>
        </div>
      </header>

      {/* ---------- основная зона ---------- */}
      <div className="flex min-h-0 flex-1">
        {/* сайдбар (desktop) */}
        <aside className="hidden w-64 flex-col gap-3 overflow-y-auto border-r border-line/70 bg-abyss/50 p-3 lg:flex">
          {/* табло */}
          <div className="clip-panel border border-line bg-panel/70 p-3.5">
            <div className="mb-2 font-disp text-[10px] tracking-[0.28em] text-inkd">ТАБЛО СЕРИИ</div>
            <div className="flex items-center justify-between">
              <div className="text-center">
                <div className="font-disp text-3xl text-neon" style={{ textShadow: '0 0 18px rgba(0,229,255,0.5)' }}>{score.h}</div>
                <div className="mt-0.5 font-disp text-[9px] tracking-widest text-neon/80">{HUMAN_NAME}</div>
              </div>
              <div className="text-center">
                <div className="font-disp text-lg text-inkd">{score.d}</div>
                <div className="mt-0.5 font-disp text-[9px] tracking-widest text-inkd">НИЧЬИ</div>
              </div>
              <div className="text-center">
                <div className="font-disp text-3xl text-flux" style={{ textShadow: '0 0 18px rgba(255,46,126,0.5)' }}>{score.a}</div>
                <div className="mt-0.5 font-disp text-[9px] tracking-widest text-flux/80">{AI_NAME}</div>
              </div>
            </div>
          </div>

          {/* параметры */}
          <div className="clip-panel border border-line bg-panel/70 p-3.5 text-[11px]">
            <div className="mb-2 font-disp text-[10px] tracking-[0.28em] text-inkd">ПАРАМЕТРЫ</div>
            <div className="space-y-1.5">
              <div className="flex justify-between"><span className="text-inkd">Сетка</span><span className="font-disp text-inkm">{size}×{size}</span></div>
              <div className="flex justify-between"><span className="text-inkd">Интеллект</span><span className="font-disp text-flux">{DIFF_LABEL[difficulty]}</span></div>
              <div className="flex justify-between"><span className="text-inkd">Раунд</span><span className="font-disp text-inkm">{round}</span></div>
              <div className="flex justify-between"><span className="text-inkd">Ходы</span><span className="font-disp text-inkm">{hist.length}</span></div>
              <div className="flex justify-between"><span className="text-inkd">Время</span><span className="font-disp text-amberx tabular-nums">{formatTime(elapsed)}</span></div>
            </div>
          </div>

          {/* журнал */}
          <div className="clip-panel min-h-0 flex-1 border border-line bg-panel/70 p-3.5">
            <div className="mb-2 font-disp text-[10px] tracking-[0.28em] text-inkd">ЖУРНАЛ ХОДОВ</div>
            {log.length === 0 ? (
              <div className="text-[11px] text-inkd/70">// ожидание первых ходов</div>
            ) : (
              <ul className="space-y-1">
                {log.map((e, i) => (
                  <li key={`${e.n}-${i}`} className={`log-in flex items-center gap-2 text-[11px] ${i === 0 ? 'opacity-100' : 'opacity-60'}`}>
                    <span className="font-disp text-[9px] text-inkd">{String(e.n).padStart(2, '0')}</span>
                    <span className={`h-1.5 w-1.5 ${e.player === 1 ? 'bg-neon' : 'bg-flux'}`} />
                    <span className={e.player === 1 ? 'text-neon/90' : 'text-flux/90'}>
                      {e.player === 1 ? HUMAN_NAME : AI_NAME}
                    </span>
                    <span className="ml-auto font-disp text-inkm">{e.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* управление */}
          <div className="space-y-2">
            <button
              onClick={undo}
              disabled={thinking || winner !== 0 || turn !== 1 || hist.length === 0}
              className="btn-hud clip-btn flex w-full items-center justify-center gap-2 border border-line bg-panel/70 px-3 py-2.5 font-disp text-[11px] tracking-widest text-inkm hover:border-amberx/60 hover:text-amberx"
            >
              <IconUndo /> ОТМЕНИТЬ ХОД <span className="text-inkd">[Z]</span>
            </button>
            <button
              onClick={newRound}
              className="btn-hud clip-btn flex w-full items-center justify-center gap-2 border border-neon/40 bg-neon/10 px-3 py-2.5 font-disp text-[11px] tracking-widest text-neon hover:bg-neon/20"
            >
              <IconRefresh /> НОВАЯ ПАРТИЯ
            </button>
          </div>
        </aside>

        {/* игровое поле */}
        <main className="relative min-w-0 flex-1 overflow-hidden">
          <div className="absolute inset-x-0 top-0 bottom-12 lg:bottom-0">
            <GameCanvas
              size={size}
              board={board}
              turn={turn}
              winner={winner}
              winLine={winLine}
              lastMove={lastMove}
              onCellClick={handleCell}
              onInvalidClick={handleInvalid}
            />
          </div>

          {/* тост раунда */}
          {toast && (
            <div key={toast.key} className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2">
              <div className="toast-anim clip-tag border border-neon/40 bg-abyss/90 px-4 py-1.5 font-disp text-[11px] tracking-[0.25em] text-neon">
                {toast.msg}
              </div>
            </div>
          )}

          {/* мобильная нижняя панель */}
          <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-2 border-t border-line/70 bg-abyss/85 px-3 py-2 backdrop-blur-sm lg:hidden">
            <div className="flex items-center gap-3 font-disp text-sm">
              <span className="text-neon">{HUMAN_NAME} {score.h}</span>
              <span className="text-[10px] text-inkd">— {score.d} —</span>
              <span className="text-flux">{score.a} {AI_NAME}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-disp text-[10px] tabular-nums text-amberx">{formatTime(elapsed)}</span>
              <button
                onClick={undo}
                disabled={thinking || winner !== 0 || turn !== 1 || hist.length === 0}
                className="btn-hud clip-btn border border-line px-2.5 py-1.5 text-inkm hover:text-amberx"
                title="Отменить ход"
              >
                <IconUndo />
              </button>
              <button
                onClick={newRound}
                className="btn-hud clip-btn border border-neon/40 px-2.5 py-1.5 text-neon"
                title="Новая партия"
              >
                <IconRefresh />
              </button>
            </div>
          </div>

          {/* оверлей результата */}
          {winner !== 0 && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-void/55 p-4 backdrop-blur-[2px]">
              <div
                className={`overlay-in clip-panel w-full max-w-sm border bg-panel/95 p-7 text-center ${
                  winner === 1 ? 'border-neon/60' : winner === 2 ? 'border-flux/60' : 'border-line'
                }`}
                style={{
                  boxShadow:
                    winner === 1
                      ? '0 0 70px rgba(0,229,255,0.28)'
                      : winner === 2
                        ? '0 0 70px rgba(255,46,126,0.28)'
                        : '0 0 50px rgba(95,127,156,0.2)',
                }}
              >
                <div className="font-disp text-[10px] tracking-[0.35em] text-inkd">
                  {winner === 3 ? 'РЕЗУЛЬТАТ // РАУНД ' + round : winner === 1 ? 'ПРОТОКОЛ ВЫПОЛНЕН' : 'СБОЙ ОБОРОНЫ'}
                </div>
                <h2
                  className={`font-disp mt-2 text-5xl ${
                    winner === 1 ? 'text-neon' : winner === 2 ? 'text-flux' : 'text-inkm'
                  }`}
                  style={{
                    textShadow:
                      winner === 1
                        ? '0 0 30px rgba(0,229,255,0.6)'
                        : winner === 2
                          ? '0 0 30px rgba(255,46,126,0.6)'
                          : 'none',
                  }}
                >
                  {winner === 1 ? 'ПОБЕДА' : winner === 2 ? 'ПОРАЖЕНИЕ' : 'НИЧЬЯ'}
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-inkd">
                  {winner === 1
                    ? `Пять в ряд. ${AI_NAME} признаёт превосходство пилота.`
                    : winner === 2
                      ? `${AI_NAME} замкнул линию из пяти. Требуется реванш.`
                      : 'Сетка заполнена. Линия из пяти не построена.'}
                </p>
                <div className="mx-auto mt-4 flex max-w-[240px] justify-between text-[11px] text-inkd">
                  <span>Ходы: <span className="font-disp text-inkm">{hist.length}</span></span>
                  <span>Время: <span className="font-disp text-amberx tabular-nums">{formatTime(elapsed)}</span></span>
                  <span>Счёт: <span className="font-disp text-inkm">{score.h}:{score.a}</span></span>
                </div>
                <div className="mt-6 flex gap-2.5">
                  <button
                    onClick={newRound}
                    className="btn-hud clip-btn flex flex-1 items-center justify-center gap-2 border border-neon bg-neon/15 px-3 py-3 font-disp text-xs tracking-widest text-neon hover:bg-neon/25 hover:text-white"
                  >
                    <IconRefresh /> РЕВАНШ <span className="opacity-60">[↵]</span>
                  </button>
                  <button
                    onClick={() => { sfx.click(); onExit(); }}
                    className="btn-hud clip-btn flex flex-1 items-center justify-center gap-2 border border-line px-3 py-3 font-disp text-xs tracking-widest text-inkm hover:border-flux/60 hover:text-flux"
                  >
                    <IconHome /> В МЕНЮ
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
