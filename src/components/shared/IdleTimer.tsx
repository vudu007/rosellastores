'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { signOut } from 'next-auth/react';
import { Clock, LogOut } from 'lucide-react';

// ── Configurable constants ────────────────────────────────────────────
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes of no activity → logout
const WARN_LEAD_MS    =  2 * 60 * 1000; // show warning 2 minutes before logout
const WARN_SECONDS    = WARN_LEAD_MS / 1000; // 120 seconds countdown

/**
 * IdleTimer — renders nothing until inactivity is detected.
 * After IDLE_TIMEOUT_MS - WARN_LEAD_MS of no activity it shows a countdown modal.
 * If the user does nothing for WARN_LEAD_MS more seconds they are signed out.
 * Any mouse/keyboard/touch event resets the timer (unless the warning is showing).
 */
export default function IdleTimer() {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown]     = useState(WARN_SECONDS);

  // Mutable ref so the activity handler never captures a stale value
  const warningActiveRef = useRef(false);

  // All timer IDs in one object so clearTimers() is a single call
  const t = useRef<{
    warn?:   ReturnType<typeof setTimeout>;
    logout?: ReturnType<typeof setTimeout>;
    tick?:   ReturnType<typeof setInterval>;
  }>({});

  const doLogout = useCallback(() => {
    signOut({ callbackUrl: '/login' });
  }, []);

  const clearTimers = useCallback(() => {
    clearTimeout(t.current.warn);
    clearTimeout(t.current.logout);
    clearInterval(t.current.tick);
  }, []);

  /** Reset the idle clock — called on every activity event and on "Stay Logged In" click */
  const startTimers = useCallback(() => {
    clearTimers();
    warningActiveRef.current = false;
    setShowWarning(false);
    setCountdown(WARN_SECONDS);

    // Fire warning WARN_LEAD_MS before the hard-logout deadline
    t.current.warn = setTimeout(() => {
      warningActiveRef.current = true;
      setShowWarning(true);

      let secs = WARN_SECONDS;
      t.current.tick = setInterval(() => {
        secs -= 1;
        setCountdown(secs);
        if (secs <= 0) clearInterval(t.current.tick);
      }, 1_000);
    }, IDLE_TIMEOUT_MS - WARN_LEAD_MS);

    // Hard logout after full idle timeout
    t.current.logout = setTimeout(doLogout, IDLE_TIMEOUT_MS);
  }, [clearTimers, doLogout]);

  useEffect(() => {
    const onActivity = () => {
      // Ignore activity while the warning modal is visible —
      // the user must explicitly click "Stay Logged In"
      if (!warningActiveRef.current) startTimers();
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(ev => window.addEventListener(ev, onActivity, { passive: true }));

    startTimers(); // Kick off on mount

    return () => {
      events.forEach(ev => window.removeEventListener(ev, onActivity));
      clearTimers();
    };
  }, [startTimers, clearTimers]);

  if (!showWarning) return null;

  const mins = String(Math.floor(countdown / 60)).padStart(2, '0');
  const secs = String(countdown % 60).padStart(2, '0');

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-card rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center animate-entrance">

        {/* Icon */}
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <Clock className="w-8 h-8 text-amber-600" />
        </div>

        <h2 className="text-xl font-bold mb-2 text-foreground">Session Expiring</h2>
        <p className="text-sm text-muted-foreground mb-5">
          You will be logged out due to inactivity in:
        </p>

        {/* Countdown */}
        <div className="text-5xl font-black text-amber-600 tabular-nums mb-3 font-mono tracking-tighter">
          {mins}:{secs}
        </div>

        <p className="text-xs text-muted-foreground mb-7">
          Move your mouse or press any key, then click &#34;Stay Logged In&#34;
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={doLogout}
            className="flex-1 h-11 rounded-xl font-semibold bg-muted hover:bg-muted/80 flex items-center justify-center gap-2 text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout Now
          </button>
          <button
            onClick={startTimers}
            className="flex-1 h-11 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm"
          >
            Stay Logged In
          </button>
        </div>

      </div>
    </div>
  );
}
