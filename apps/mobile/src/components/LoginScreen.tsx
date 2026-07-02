import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { LogIn, UserPlus } from "lucide-react-native";
import type { RegisterInput } from "../types";
import { AnimatedSignal } from "./AnimatedSignal";

type Props = {
  error: string | null;
  loading: boolean;
  onLogin: (identifier: string, password: string) => Promise<void>;
  onRegister: (input: RegisterInput) => Promise<void>;
};

type Mode = "login" | "register";

export function LoginScreen({ error, loading, onLogin, onRegister }: Props) {
  const [mode, setMode] = useState<Mode>("register");
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (mode === "login") {
      const trimmedIdentifier = identifier.trim();

      if (!trimmedIdentifier) {
        setLocalError("Enter your username, handle, or email.");
        return;
      }

      if (!password) {
        setLocalError("Enter your password.");
        return;
      }

      setLocalError(null);
      await onLogin(trimmedIdentifier, password);
      return;
    }

    const registration = {
      username: username.trim(),
      handle: handle.trim(),
      email: email.trim(),
      displayName: displayName.trim(),
      password,
    };

    if (!registration.displayName) {
      setLocalError("Enter your display name.");
      return;
    }

    if (!registration.username) {
      setLocalError("Choose a username.");
      return;
    }

    if (!registration.handle) {
      setLocalError("Choose a handle.");
      return;
    }

    if (!registration.email) {
      setLocalError("Enter your email.");
      return;
    }

    if (registration.password.length < 8) {
      setLocalError("Password must be at least 8 characters.");
      return;
    }

    setLocalError(null);
    await onRegister(registration);
  };

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setLocalError(null);
  };

  const activeError = localError ?? error;

  return (
    <LinearGradient colors={["#f7fbf7", "#e3efe9"]} style={styles.shell}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.select({ ios: "padding", default: undefined })}
          style={styles.keyboard}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <AnimatedSignal />
            <Text style={styles.brand}>TalkNest</Text>
            <Text style={styles.subtitle}>
              Create a handle and start private conversations in real time.
            </Text>

            <View style={styles.form}>
              <View style={styles.modeSwitch}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => switchMode("register")}
                  style={[
                    styles.modeButton,
                    mode === "register" ? styles.modeButtonActive : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.modeText,
                      mode === "register" ? styles.modeTextActive : null,
                    ]}
                  >
                    Sign up
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => switchMode("login")}
                  style={[
                    styles.modeButton,
                    mode === "login" ? styles.modeButtonActive : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.modeText,
                      mode === "login" ? styles.modeTextActive : null,
                    ]}
                  >
                    Sign in
                  </Text>
                </Pressable>
              </View>

              {mode === "register" ? (
                <>
                  <Field
                    editable={!loading}
                    label="Display name"
                    onChangeText={setDisplayName}
                    placeholder="Your name"
                    value={displayName}
                  />
                  <Field
                    autoCapitalize="none"
                    editable={!loading}
                    label="Username"
                    onChangeText={setUsername}
                    placeholder="yourname"
                    value={username}
                  />
                  <Field
                    autoCapitalize="none"
                    editable={!loading}
                    label="Handle"
                    onChangeText={setHandle}
                    placeholder="@yourhandle"
                    value={handle}
                  />
                  <Field
                    autoCapitalize="none"
                    editable={!loading}
                    keyboardType="email-address"
                    label="Email"
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    value={email}
                  />
                </>
              ) : (
                <Field
                  autoCapitalize="none"
                  editable={!loading}
                  label="Username, handle, or email"
                  onChangeText={setIdentifier}
                  placeholder="@yourhandle"
                  value={identifier}
                />
              )}

              <Field
                editable={!loading}
                label="Password"
                onChangeText={setPassword}
                onSubmitEditing={handleSubmit}
                placeholder="Minimum 8 characters"
                secureTextEntry
                value={password}
              />

              {activeError && (
                <Text accessibilityLiveRegion="polite" style={styles.error}>
                  {activeError}
                </Text>
              )}

              <Pressable
                accessibilityRole="button"
                disabled={loading}
                onPress={handleSubmit}
                style={({ pressed }) => [
                  styles.submitButton,
                  pressed && !loading ? styles.buttonPressed : null,
                  loading ? styles.buttonDisabled : null,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#f8faf7" />
                ) : (
                  <>
                    {mode === "register" ? (
                      <UserPlus color="#f8faf7" size={20} strokeWidth={2.4} />
                    ) : (
                      <LogIn color="#f8faf7" size={20} strokeWidth={2.4} />
                    )}
                    <Text style={styles.submitText}>
                      {mode === "register" ? "Create account" : "Sign in"}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  editable?: boolean;
  keyboardType?: "default" | "email-address";
  onSubmitEditing?: () => void;
  secureTextEntry?: boolean;
};

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize,
  editable,
  keyboardType,
  onSubmitEditing,
  secureTextEntry,
}: FieldProps) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        editable={editable}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor="#7e918a"
        returnKeyType={onSubmitEditing ? "send" : "next"}
        secureTextEntry={secureTextEntry}
        style={styles.input}
        value={value}
      />
    </>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  keyboard: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  brand: {
    color: "#12221d",
    fontSize: 42,
    fontWeight: "800",
    letterSpacing: 0,
    textAlign: "center",
  },
  subtitle: {
    color: "#51635e",
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 28,
    marginTop: 8,
    textAlign: "center",
  },
  form: {
    alignSelf: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d9e5df",
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: 440,
    padding: 18,
    shadowColor: "#12221d",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    width: "100%",
  },
  modeSwitch: {
    backgroundColor: "#edf4f0",
    borderRadius: 8,
    flexDirection: "row",
    gap: 4,
    marginBottom: 10,
    padding: 4,
  },
  modeButton: {
    alignItems: "center",
    borderRadius: 7,
    flex: 1,
    minHeight: 40,
    justifyContent: "center",
  },
  modeButtonActive: {
    backgroundColor: "#143f37",
  },
  modeText: {
    color: "#3e584f",
    fontSize: 14,
    fontWeight: "800",
  },
  modeTextActive: {
    color: "#f8faf7",
  },
  label: {
    color: "#243a33",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: "#f7faf8",
    borderColor: "#c9d9d2",
    borderRadius: 8,
    borderWidth: 1,
    color: "#10201b",
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  error: {
    color: "#b84031",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
  },
  submitButton: {
    alignItems: "center",
    backgroundColor: "#143f37",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 18,
    minHeight: 52,
  },
  submitText: {
    color: "#f8faf7",
    fontSize: 16,
    fontWeight: "800",
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.78,
  },
});
