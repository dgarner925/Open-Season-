/**
 * Which mode the app is in: In the Woods (hunting) or On the Water (fishing).
 *
 * One app, two moods. The mode decides the theme, the tab bar and which route
 * group you land in; it is not a feature flag and not a user setting buried in
 * Profile -- it is the toggle in the Home header, and it is the first thing
 * restored on launch.
 *
 * Persisted per DEVICE, not per account, which is the same call
 * src/lib/onboardingSeen.ts makes and for the same reason: this is a note
 * about what this phone was last showing, not a fact about the person. Someone
 * who signs in on a second phone starts in the woods there, which is the
 * default anyone starts at.
 *
 * Storage can throw. It must never block a render or lose the toggle: the
 * in-memory value is the truth for the session, and a failed write costs at
 * most the mode being forgotten by the next launch.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

// Defined in src/lib/effectiveMode.ts, which has no react-native in its
// import graph so the routing decision can be tested. Re-exported here
// because this is where the rest of the app already imports Mode from.
export type { Mode } from '@/lib/effectiveMode';
import type { Mode } from '@/lib/effectiveMode';

const KEY = 'os.mode.v1';
const DEFAULT: Mode = 'hunt';

function isMode(v: unknown): v is Mode {
  return v === 'hunt' || v === 'otw';
}

type ModeState = {
  mode: Mode;
  setMode: (next: Mode) => void;
  toggle: () => void;
  /**
   * False until the persisted mode has been read from disk.
   *
   * Launch routing waits on this. Without it a user whose mode is 'otw' gets
   * one frame of the hunting Home before being redirected -- a dark flash on
   * the way to a cream screen, on every cold start.
   */
  ready: boolean;
};

const ModeContext = createContext<ModeState | null>(null);

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Mode>(DEFAULT);
  const [ready, setReady] = useState(false);
  /**
   * Guards against the read landing after a write. Someone can hit the toggle
   * during the first frames; if the disk read resolved afterwards it would
   * quietly undo them.
   */
  const touched = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      let stored: Mode | null = null;
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (isMode(raw)) stored = raw;
      } catch {
        /* unreadable storage means the default, not a broken app */
      }
      if (!active) return;
      if (stored && !touched.current) setModeState(stored);
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const setMode = useCallback((next: Mode) => {
    // In memory first, so the toggle is instant and a slow or failing disk is
    // invisible. The write is fire-and-forget on purpose.
    touched.current = true;
    setModeState(next);
    AsyncStorage.setItem(KEY, next).catch(() => {
      /* session-only, by design -- see the header */
    });
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === 'hunt' ? 'otw' : 'hunt');
  }, [mode, setMode]);

  const value = useMemo<ModeState>(() => ({ mode, setMode, toggle, ready }), [mode, setMode, toggle, ready]);

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode(): ModeState {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error('useMode must be used inside ModeProvider');
  return ctx;
}

/**
 * The mode without requiring the provider.
 *
 * For code that may render outside the tree during a transition and should
 * simply behave as hunting rather than crash.
 */
export function useModeSafe(): Mode {
  return useContext(ModeContext)?.mode ?? DEFAULT;
}
