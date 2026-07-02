import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet } from "react-native";
import {
  fetchCurrentUser,
  login as loginRequest,
  register as registerRequest,
} from "./api";
import { ChatScreen } from "./components/ChatScreen";
import { LoginScreen } from "./components/LoginScreen";
import {
  clearStoredSession,
  getStoredSession,
  getStoredTheme,
  saveSession,
  saveTheme,
} from "./storage";
import type { AppTheme, RegisterInput, Session } from "./types";

type KeyboardShortcutEvent = {
  ctrlKey?: boolean;
  key?: string;
  metaKey?: boolean;
  preventDefault?: () => void;
};

type KeyboardTarget = {
  addEventListener?: (
    type: "keydown",
    listener: (event: KeyboardShortcutEvent) => void,
  ) => void;
  removeEventListener?: (
    type: "keydown",
    listener: (event: KeyboardShortcutEvent) => void,
  ) => void;
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authing, setAuthing] = useState(false);
  const [theme, setTheme] = useState<AppTheme>("light");

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const nextTheme = current === "light" ? "dark" : "light";
      void saveTheme(nextTheme);
      return nextTheme;
    });
  }, []);

  useEffect(() => {
    const keyboardTarget = globalThis as unknown as KeyboardTarget;

    if (!keyboardTarget.addEventListener) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardShortcutEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key?.toLowerCase() === "d") {
        event.preventDefault?.();
        toggleTheme();
      }
    };

    keyboardTarget.addEventListener("keydown", handleKeyDown);

    return () => {
      keyboardTarget.removeEventListener?.("keydown", handleKeyDown);
    };
  }, [toggleTheme]);

  useEffect(() => {
    let active = true;

    Promise.all([getStoredSession(), getStoredTheme()])
      .then(async ([stored, storedTheme]) => {
        if (active) {
          setTheme(storedTheme);
        }

        if (!stored) {
          return;
        }

        const user = await fetchCurrentUser(stored.token);

        if (active) {
          const restored = { ...stored, user };
          setSession(restored);
          await saveSession(restored);
        }
      })
      .catch(async () => {
        await clearStoredSession();
      })
      .finally(() => {
        if (active) {
          setBooting(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const handleLogin = async (identifier: string, password: string) => {
    setAuthing(true);
    setAuthError(null);

    try {
      const nextSession = await loginRequest(identifier, password);
      await saveSession(nextSession);
      setSession(nextSession);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to log in");
    } finally {
      setAuthing(false);
    }
  };

  const handleRegister = async (input: RegisterInput) => {
    setAuthing(true);
    setAuthError(null);

    try {
      const nextSession = await registerRequest(input);
      await saveSession(nextSession);
      setSession(nextSession);
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Unable to create account",
      );
    } finally {
      setAuthing(false);
    }
  };

  const handleLogout = async () => {
    await clearStoredSession();
    setSession(null);
    setAuthError(null);
  };

  if (booting) {
    return (
      <SafeAreaView
        style={[styles.boot, theme === "dark" ? styles.bootDark : null]}
      >
        <ActivityIndicator color={theme === "dark" ? "#7dd3fc" : "#2563eb"} />
      </SafeAreaView>
    );
  }

  if (session) {
    return (
      <ChatScreen
        session={session}
        onLogout={handleLogout}
        onToggleTheme={toggleTheme}
        theme={theme}
      />
    );
  }

  return (
    <LoginScreen
      error={authError}
      loading={authing}
      onLogin={handleLogin}
      onRegister={handleRegister}
      onToggleTheme={toggleTheme}
      theme={theme}
    />
  );
}

const styles = StyleSheet.create({
  boot: {
    alignItems: "center",
    backgroundColor: "#eef4ff",
    flex: 1,
    justifyContent: "center",
  },
  bootDark: {
    backgroundColor: "#111827",
  },
});
