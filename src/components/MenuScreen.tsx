import type { ReactNode } from 'react';
import type { BoardSize, Difficulty, Player } from '../game/core';
import { AI_NAME, DIFF_LABEL, HUMAN_NAME } from '../game/core';
import { sfx } from '../game/audio';

export interface Settings {
  size: BoardSize;
  difficulty: Difficulty;
  first: Player;
}

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onStart: () => void;
}

function GridPreview({ size, active }: { size: BoardSize; active: boolean }) {
  const lines = size === 10 ? 6 : size === 20 ? 9 : 12;
  const step = 76 / (lines - 1);
  const pts: Array<[number, number, 'c' | 'm']> =
    size === 10
      ? [[2, 2, 'c'], [3, 3, 'm'], [2, 3, 'c'], [3, 2, 'm']]
      : size === 20
        ? [[4, 3, 'c'], [3, 4, 'm'], [4, 4, 'c'], [5, 5, 'm'], [2, 5, 'c']]
        : [[5, 4, 'c'], [4, 5, 'm'], [5, 5, 'c'], [6, 6, 'm'], [3, 6, 'c'], [6, 3, 'm']];
  return (
    <svg viewBox="0 0 84 84" className="h-full w-full">
      <rect x="2" y="2" width="80" height="80" fill={active ? 'rgba(0,229,255,0.06)' : 'rgba(10,23,48,0.5)'} />
      {Array.from({ length: lines }, (_, i) => (
        <g key={i} stroke={active ? 'rgba(0,229,255,0.5)' : 'rgba(95,127,156,0.35)'} strokeWidth="1">
          <line x1={4 + i * step} y1="4" x2={4 + i * step} y2="80" />
          <line x1="4" y1={4 + i * step} x2="80" y2={4 + i * step} />
        </g>
      ))}
      {pts.map(([c, r, who], i) => (
        <circle
          key={i}
          cx={4 + c * step}
          cy={4 + r * step}
          r="3.4"
          fill={who === 'c' ? '#00e5ff' : '#ff2e7e'}
          opacity={0.9}
        >
          {active && (
            <animate attributeName="opacity" values="0.45;1;0.45" dur="1.6s" begin={`${i * 0.2}s`} repeatCount="indefinite" />
          )}
        </circle>
      ))}
    </svg>
  );
}

const IconPlay = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
    <path d="M6 3.8v16.4c0 .8.9 1.3 1.6.9l13-8.2c.6-.4.6-1.4 0-1.8l-13-8.2c-.7-.4-1.6.1-1.6.9z" />
  </svg>
);

const IconCpu = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
    <rect x="6" y="6" width="12" height="12" />
    <rect x="10" y="10" width="4" height="4" fill="currentColor" stroke="none" />
    <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
  </svg>
);

const IconUser = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20c1.4-3.4 4.2-5 7.5-5s6.1 1.6 7.5 5" />
  </svg>
);

function OptionRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="h-px w-4 bg-neon/60" />
        <span className="font-disp text-[11px] tracking-[0.28em] text-neon/90">{label}</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      {children}
    </div>
  );
}

export default function MenuScreen({ settings, onChange, onStart }: Props) {
  const pick = (patch: Partial<Settings>) => {
    sfx.click();
    onChange({ ...settings, ...patch });
  };

  return (
    <div className="relative z-10 mx-auto flex min-h-full w-full max-w-6xl flex-col justify-center px-5 py-8 sm:px-8">
      <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
        {/* левая колонка — идентичность */}
        <div>
          <div className="rise-in mb-3 flex items-center gap-3">
            <svg viewBox="0 0 40 40" className="spin-slow h-9 w-9 text-neon" fill="none" stroke="currentColor" strokeWidth="1.6">
              <polygon points="20,2 36,11 36,29 20,38 4,29 4,11" />
              <circle cx="20" cy="20" r="7" strokeDasharray="4 3" />
            </svg>
            <span className="clip-tag bg-neon/10 px-2.5 py-1 font-disp text-[10px] tracking-[0.3em] text-neon">
              ПРОТОКОЛ // ГОМОКУ
            </span>
          </div>

          <h1
            className="glitch rise-in d1 font-disp text-6xl leading-none text-white sm:text-7xl lg:text-8xl"
            data-text="НЕКСУС-5"
            style={{ textShadow: '0 0 34px rgba(0,229,255,0.4)' }}
          >
            НЕКСУС-5
          </h1>

          <p className="rise-in d2 mt-5 max-w-md text-base leading-relaxed text-inkm">
            Сетка. Пять символов в ряд — по прямой или диагонали — и сектор твой.
            Противник: боевой интеллект <span className="font-semibold text-flux">{AI_NAME}</span>,
            просчитывающий угрозы на два хода вперёд.
          </p>

          <div className="rise-in d3 mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-inkd">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 bg-neon" /> ЛКМ / ТАП — ход
            </span>
            <span className="flex items-center gap-1.5">
              <span className="clip-tag bg-panel px-1.5 py-0.5 font-disp text-[10px] text-inkm">Z</span> отмена хода
            </span>
            <span className="flex items-center gap-1.5">
              <span className="clip-tag bg-panel px-1.5 py-0.5 font-disp text-[10px] text-inkm">M</span> звук
            </span>
            <span className="flex items-center gap-1.5">
              <span className="clip-tag bg-panel px-1.5 py-0.5 font-disp text-[10px] text-inkm">ESC</span> меню
            </span>
          </div>

          <div className="rise-in d4 mt-8 flex items-center gap-3 text-[11px] tracking-wider text-inkd">
            <span className="font-disp text-neon">{HUMAN_NAME}</span>
            <span className="h-px w-10 bg-line" />
            <span>циан против</span>
            <span className="h-px w-10 bg-line" />
            <span className="font-disp text-flux">{AI_NAME}</span>
          </div>
        </div>

        {/* правая колонка — консель конфигурации */}
        <div className="clip-panel rise-in d2 border border-line bg-panel/80 p-6 backdrop-blur-sm sm:p-7"
          style={{ boxShadow: '0 0 60px rgba(0,229,255,0.07), inset 0 0 40px rgba(4,10,24,0.6)' }}>
          <div className="mb-5 flex items-center justify-between">
            <span className="font-disp text-xs tracking-[0.3em] text-inkm">КОНФИГУРАЦИЯ МАТЧА</span>
            <span className="blink-dot h-2 w-2 bg-neon" />
          </div>

          <div className="space-y-6">
            <OptionRow label="РАЗМЕР СЕТКИ">
              <div className="grid grid-cols-3 gap-2.5">
                {([10, 20, 30] as BoardSize[]).map((s) => {
                  const active = settings.size === s;
                  return (
                    <button
                      key={s}
                      onClick={() => pick({ size: s })}
                      className={`sel-card clip-btn relative border p-2 text-left ${
                        active
                          ? 'border-neon bg-neon/10 shadow-[0_0_24px_rgba(0,229,255,0.25)]'
                          : 'border-line bg-abyss/60 hover:border-neon/50'
                      }`}
                    >
                      <div className="h-16 w-full sm:h-20">
                        <GridPreview size={s} active={active} />
                      </div>
                      <div className="mt-1.5 flex items-baseline justify-between px-0.5">
                        <span className={`font-disp text-sm ${active ? 'text-neon' : 'text-inkm'}`}>{s}×{s}</span>
                        <span className="text-[9px] tracking-wider text-inkd">{s * s}</span>
                      </div>
                      {active && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 bg-neon" />}
                    </button>
                  );
                })}
              </div>
            </OptionRow>

            <OptionRow label="УРОВЕНЬ ИНТЕЛЛЕКТА">
              <div className="grid grid-cols-3 gap-2.5">
                {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => {
                  const active = settings.difficulty === d;
                  return (
                    <button
                      key={d}
                      onClick={() => pick({ difficulty: d })}
                      className={`sel-card clip-btn flex flex-col items-center gap-1 border px-2 py-3 ${
                        active
                          ? 'border-flux bg-flux/10 shadow-[0_0_24px_rgba(255,46,126,0.22)]'
                          : 'border-line bg-abyss/60 hover:border-flux/50'
                      }`}
                    >
                      <span className={active ? 'text-flux' : 'text-inkd'}>
                        <IconCpu />
                      </span>
                      <span className={`font-disp text-[10px] tracking-wider ${active ? 'text-flux' : 'text-inkm'}`}>
                        {DIFF_LABEL[d]}
                      </span>
                      <span className="flex gap-0.5">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className={`h-1 w-3 ${
                              i <= ['easy', 'normal', 'hard'].indexOf(d)
                                ? active ? 'bg-flux' : 'bg-inkd'
                                : 'bg-line'
                            }`}
                          />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </OptionRow>

            <OptionRow label="ПЕРВЫЙ ХОД">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => pick({ first: 1 })}
                  className={`sel-card clip-btn flex items-center justify-center gap-2 border px-3 py-2.5 ${
                    settings.first === 1
                      ? 'border-neon bg-neon/10 text-neon'
                      : 'border-line bg-abyss/60 text-inkm hover:border-neon/50'
                  }`}
                >
                  <IconUser />
                  <span className="font-disp text-[11px] tracking-wider">{HUMAN_NAME}</span>
                </button>
                <button
                  onClick={() => pick({ first: 2 })}
                  className={`sel-card clip-btn flex items-center justify-center gap-2 border px-3 py-2.5 ${
                    settings.first === 2
                      ? 'border-flux bg-flux/10 text-flux'
                      : 'border-line bg-abyss/60 text-inkm hover:border-flux/50'
                  }`}
                >
                  <IconCpu />
                  <span className="font-disp text-[11px] tracking-wider">{AI_NAME}</span>
                </button>
              </div>
            </OptionRow>

            <button
              onClick={() => {
                sfx.unlock();
                sfx.start();
                onStart();
              }}
              className="btn-hud clip-btn pulse-glow-c group flex w-full items-center justify-center gap-3 border border-neon bg-neon/15 px-4 py-4 font-disp text-base tracking-[0.2em] text-neon hover:bg-neon/25 hover:text-white"
            >
              <IconPlay />
              ЗАПУСТИТЬ СИМУЛЯЦИЮ
              <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
