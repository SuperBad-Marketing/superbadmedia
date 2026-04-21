/**
 * Cookie/localStorage management for public visitor egg state.
 *
 * State persistence: both cookie and localStorage for redundancy.
 * Losing one shouldn't re-fire the welcome egg.
 *
 * Client-side only — no server dependencies.
 */

const STORAGE_KEY = "sb_egg_state";
const COOKIE_NAME = "sb_egg_state";
const COOKIE_MAX_AGE_DAYS = 90;

export interface PublicEggClientState {
  firstEggDeliveredAt: number | null;
  lastHiddenEggFiredAt: number | null;
  firedEggIds: string[];
  tricksDisabled: boolean;
  visitDates: string[];
  sessionFiredEggIds: string[];
}

const DEFAULT_STATE: PublicEggClientState = {
  firstEggDeliveredAt: null,
  lastHiddenEggFiredAt: null,
  firedEggIds: [],
  tricksDisabled: false,
  visitDates: [],
  sessionFiredEggIds: [],
};

function readFromLocalStorage(): PublicEggClientState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PublicEggClientState;
  } catch {
    return null;
  }
}

function readFromCookie(): PublicEggClientState | null {
  try {
    const match = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${COOKIE_NAME}=`));
    if (!match) return null;
    return JSON.parse(decodeURIComponent(match.split("=").slice(1).join("="))) as PublicEggClientState;
  } catch {
    return null;
  }
}

export function readPublicEggState(): PublicEggClientState {
  const ls = readFromLocalStorage();
  const ck = readFromCookie();

  if (ls && ck) {
    return ls.firedEggIds.length >= ck.firedEggIds.length ? ls : ck;
  }
  return ls ?? ck ?? { ...DEFAULT_STATE };
}

export function writePublicEggState(state: PublicEggClientState): void {
  const json = JSON.stringify(state);

  try {
    localStorage.setItem(STORAGE_KEY, json);
  } catch {
    // localStorage unavailable — cookie fallback only
  }

  try {
    const maxAge = COOKIE_MAX_AGE_DAYS * 86400;
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(json)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  } catch {
    // Cookie write failed
  }
}

export function recordVisit(state: PublicEggClientState): PublicEggClientState {
  const today = new Date().toISOString().slice(0, 10);
  if (state.visitDates.includes(today)) return state;

  const visitDates = [...state.visitDates, today].slice(-60);
  return { ...state, visitDates };
}

export function recordEggFired(
  state: PublicEggClientState,
  eggId: string,
): PublicEggClientState {
  const now = Date.now();
  return {
    ...state,
    firstEggDeliveredAt: state.firstEggDeliveredAt ?? now,
    lastHiddenEggFiredAt: now,
    firedEggIds: [...state.firedEggIds, eggId].slice(-50),
    sessionFiredEggIds: [...state.sessionFiredEggIds, eggId],
  };
}

export function getVisitCount(state: PublicEggClientState): number {
  return state.visitDates.length;
}

export function setTricksDisabled(
  state: PublicEggClientState,
  disabled: boolean,
): PublicEggClientState {
  return { ...state, tricksDisabled: disabled };
}
