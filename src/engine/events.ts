export type LogTone = 'info' | 'good' | 'bad' | 'lore' | 'epic';

export interface LogEntry {
  id: number;
  text: string;
  tone: LogTone;
}

type Listener = (entry: LogEntry) => void;

const listeners = new Set<Listener>();
let nextId = 1;

/** The engine narrates through this; the UI (if any) listens. */
export function log(text: string, tone: LogTone = 'info'): void {
  const entry = { id: nextId++, text, tone };
  for (const l of listeners) l(entry);
}

export function onLog(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
