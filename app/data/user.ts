export type AppUser = { name: string };

const KEY = "av_user";

export function getStoredUser(): AppUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AppUser) : null;
  } catch {
    return null;
  }
}

export function saveUser(u: AppUser): void {
  localStorage.setItem(KEY, JSON.stringify(u));
}

export function removeUser(): void {
  localStorage.removeItem(KEY);
}
