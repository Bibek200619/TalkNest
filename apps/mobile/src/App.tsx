import { useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet } from "react-native";
import { fetchCurrentUser, login as loginRequest } from "./api";
import { ChatScreen } from "./components/ChatScreen";
import { LoginScreen } from "./components/LoginScreen";
import { clearStoredSession, getStoredSession, saveSession } from "./storage";
import type { Session } from "./types";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

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
    setLoggingIn(true);
    setLoginError(null);

    try {
      const nextSession = await loginRequest(identifier, password);
      await saveSession(nextSession);
      setSession(nextSession);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Unable to log in");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await clearStoredSession();
    setSession(null);
    setLoginError(null);
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

  return <LoginScreen error={loginError} loading={loggingIn} onSubmit={handleLogin} />;
}

const styles = StyleSheet.create({
  boot: {
    alignItems: "center",
    backgroundColor: "#f7fbf7",
    flex: 1,
    justifyContent: "center"
  }
});
