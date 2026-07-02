import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AppTheme, Session } from "./types";

const SESSION_KEY = "talknest.session.v1";
const THEME_KEY = "talknest.theme.v1";

export async function getStoredSession(): Promise<Session | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as Session;
  } catch {
    await clearStoredSession();
    return null;
  }
}

export async function saveSession(session: Session) {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function clearStoredSession() {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function getStoredTheme(): Promise<AppTheme> {
  const raw = await AsyncStorage.getItem(THEME_KEY);

  return raw === "dark" ? "dark" : "light";
}

export async function saveTheme(theme: AppTheme) {
  await AsyncStorage.setItem(THEME_KEY, theme);
}
