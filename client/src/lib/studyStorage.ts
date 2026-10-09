export type StudyStatus = "not_started" | "in_progress" | "complete";

export type StoredProgress = {
  courseId: string;
  lessonId: string;
  status: StudyStatus;
  positionSeconds: number;
  updatedAt: string;
};

export type StoredNote = {
  courseId: string;
  content: string;
  updatedAt: string;
};

const PROGRESS_KEY = "board-studio:guest-progress:v1";
const NOTES_KEY = "board-studio:guest-notes:v1";

function read<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in privacy modes. The UI remains usable in-session.
  }
}

export function getGuestProgress(): StoredProgress[] {
  return read<StoredProgress[]>(PROGRESS_KEY, []);
}

export function saveGuestProgress(progress: StoredProgress) {
  const current = getGuestProgress().filter(item => !(item.courseId === progress.courseId && item.lessonId === progress.lessonId));
  write(PROGRESS_KEY, [...current, progress]);
}

export function getGuestNotes(): StoredNote[] {
  return read<StoredNote[]>(NOTES_KEY, []);
}

export function saveGuestNote(note: StoredNote) {
  const current = getGuestNotes().filter(item => item.courseId !== note.courseId);
  write(NOTES_KEY, [...current, note]);
}

export function courseStatus(progress: StoredProgress[], courseId: string): StudyStatus {
  const explicit = progress.find(item => item.courseId === courseId && item.lessonId === "__course__");
  if (explicit) return explicit.status;
  const courseItems = progress.filter(item => item.courseId === courseId);
  if (courseItems.some(item => item.status === "complete")) return "in_progress";
  if (courseItems.some(item => item.status === "in_progress" || item.positionSeconds > 0)) return "in_progress";
  return "not_started";
}
