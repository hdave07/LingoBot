export interface ProgressData {
  sessions: number;
  exchanges: number;
  streak: number;
  lastPracticed: string | null; // YYYY-MM-DD
}

const KEY = "lingobot_progress";

const DEFAULT: ProgressData = {
  sessions: 0,
  exchanges: 0,
  streak: 0,
  lastPracticed: null,
};

export function getProgress(): ProgressData {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ProgressData) : { ...DEFAULT };
  } catch {
    return { ...DEFAULT };
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000
  );
}

function notify() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("lingobot:progress"));
  }
}

export function recordSessionStart(): void {
  try {
    const data = getProgress();
    const t = today();

    let { streak } = data;
    if (data.lastPracticed === null) {
      streak = 1;
    } else if (data.lastPracticed === t) {
      // already practiced today — don't change streak
    } else if (daysBetween(data.lastPracticed, t) === 1) {
      streak += 1;
    } else {
      streak = 1;
    }

    localStorage.setItem(
      KEY,
      JSON.stringify({
        ...data,
        sessions: data.sessions + 1,
        streak,
        lastPracticed: t,
      })
    );
    notify();
  } catch { /* localStorage unavailable */ }
}

export function recordExchange(): void {
  try {
    const data = getProgress();
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...data, exchanges: data.exchanges + 1 })
    );
    notify();
  } catch { /* localStorage unavailable */ }
}
