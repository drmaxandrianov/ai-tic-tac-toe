import { useCallback, useEffect, useState } from 'react';
import MenuScreen from './components/MenuScreen';
import type { Settings } from './components/MenuScreen';
import GameScreen from './components/GameScreen';
import { sfx } from './game/audio';
import type { BoardSize, Difficulty, Player } from './game/core';

type Screen = 'menu' | 'game';

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem('nexus5-settings');
    if (raw) {
      const p = JSON.parse(raw) as Partial<Settings>;
      const size: BoardSize = p.size === 20 || p.size === 30 ? p.size : 10;
      const difficulty: Difficulty =
        p.difficulty === 'easy' || p.difficulty === 'hard' ? p.difficulty : 'normal';
      const first: Player = p.first === 2 ? 2 : 1;
      return { size, difficulty, first };
    }
  } catch {
    /* noop */
  }
  return { size: 10, difficulty: 'normal', first: 1 };
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [muted, setMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem('nexus5-muted') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    sfx.setMuted(muted);
    try {
      localStorage.setItem('nexus5-muted', muted ? '1' : '0');
    } catch {
      /* noop */
    }
  }, [muted]);

  useEffect(() => {
    try {
      localStorage.setItem('nexus5-settings', JSON.stringify(settings));
    } catch {
      /* noop */
    }
  }, [settings]);

  const toggleMute = useCallback(() => {
    sfx.unlock();
    setMuted((m) => !m);
  }, []);

  const startGame = useCallback(() => setScreen('game'), []);
  const exitGame = useCallback(() => setScreen('menu'), []);

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-void font-body">
      {/* фоновые слои */}
      <div className="fx-stars" />
      <div className="fx-stars2" />
      <div className="fx-grid" />
      <div className="fx-streak" style={{ top: '22%' }} />
      <div className="fx-streak s2" style={{ top: '64%' }} />
      <div className="fx-vig" />
      <div className="fx-scan" />

      {screen === 'menu' ? (
        <div className="h-full overflow-y-auto">
          <MenuScreen settings={settings} onChange={setSettings} onStart={startGame} />
        </div>
      ) : (
        <GameScreen
          key={`${settings.size}-${settings.difficulty}-${settings.first}`}
          settings={settings}
          muted={muted}
          onToggleMute={toggleMute}
          onExit={exitGame}
        />
      )}
    </div>
  );
}
