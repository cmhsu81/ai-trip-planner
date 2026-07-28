// Feasibility notes are only returned once, at generation time (the backend
// doesn't persist them on the Trip row) — this passes them from the planner
// page to the trip detail page across the post-generate redirect without a
// schema change. sessionStorage (not localStorage) because they're only
// relevant for the one just-generated trip in this tab, not worth persisting.

function key(tripId: string): string {
  return `trip-feasibility-${tripId}`;
}

export function storeFeasibilityNotes(tripId: string, notes: string[]): void {
  if (typeof window === "undefined" || notes.length === 0) return;
  sessionStorage.setItem(key(tripId), JSON.stringify(notes));
}

export function consumeFeasibilityNotes(tripId: string): string[] {
  if (typeof window === "undefined") return [];
  const raw = sessionStorage.getItem(key(tripId));
  if (!raw) return [];
  sessionStorage.removeItem(key(tripId));
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}
