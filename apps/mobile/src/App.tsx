import { useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet } from "react-native";
import {
  fetchCurrentUser,
  login as loginRequest,
  register as registerRequest,
} from "./api";
import { ChatScreen } from "./components/ChatScreen";
import { LoginScreen } from "./components/LoginScreen";
import { clearStoredSession, getStoredSession, saveSession } from "./storage";
import type { RegisterInput, Session } from "./types";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authing, setAuthing] = useState(false);

  useEffect(() => {
    let active = true;

    getStoredSession()
      .then(async (stored) => {
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
      <SafeAreaView style={styles.boot}>
        <ActivityIndicator color="#143f37" />
      </SafeAreaView>
    );
  }

  if (session) {
    return <ChatScreen session={session} onLogout={handleLogout} />;
  }

  return (
    <LoginScreen
      error={authError}
      loading={authing}
      onLogin={handleLogin}
      onRegister={handleRegister}
    />
  );
}

const styles = StyleSheet.create({
  boot: {
    alignItems: "center",
    backgroundColor: "#f7fbf7",
    flex: 1,
    justifyContent: "center",
  },
});
