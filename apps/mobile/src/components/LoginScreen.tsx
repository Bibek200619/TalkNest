import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { LogIn } from "lucide-react-native";
import { AnimatedSignal } from "./AnimatedSignal";

type Props = {
  error: string | null;
  loading: boolean;
  onSubmit: (identifier: string, password: string) => Promise<void>;
};

export function LoginScreen({ error, loading, onSubmit }: Props) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmedIdentifier = identifier.trim();

    if (!trimmedIdentifier) {
      setLocalError("Please enter your username.");
      return;
    }

    if (!password) {
      setLocalError("Please enter your password.");
      return;
    }

    setLocalError(null);
    await onSubmit(trimmedIdentifier, password);
  };

  return (
    <LinearGradient colors={["#f7fbf7", "#e4f0ea"]} style={styles.shell}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.select({ ios: "padding", default: undefined })}
          style={styles.keyboard}
        >
          <View style={styles.content}>
            <AnimatedSignal />
            <Text style={styles.brand}>TalkNest</Text>
            <Text style={styles.subtitle}>Simple real-time chat for focused teams.</Text>

            <View style={styles.form}>
              <Text style={styles.label}>Username or email</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                onChangeText={setIdentifier}
                placeholder="alex"
                placeholderTextColor="#7e918a"
                returnKeyType="next"
                style={styles.input}
                value={identifier}
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                editable={!loading}
                onChangeText={setPassword}
                placeholder="password"
                placeholderTextColor="#7e918a"
                returnKeyType="send"
                secureTextEntry
                style={styles.input}
                value={password}
                onSubmitEditing={handleSubmit}
              />

              {(localError || error) && (
                <Text accessibilityLiveRegion="polite" style={styles.error}>
                  {localError ?? error}
                </Text>
              )}

              <Pressable
                accessibilityRole="button"
                disabled={loading}
                onPress={handleSubmit}
                style={({ pressed }) => [
                  styles.loginButton,
                  pressed && !loading ? styles.buttonPressed : null,
                  loading ? styles.buttonDisabled : null
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#f8faf7" />
                ) : (
                  <>
                    <LogIn color="#f8faf7" size={20} strokeWidth={2.4} />
                    <Text style={styles.loginText}>Log in</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1
  },
  safe: {
    flex: 1
  },
  keyboard: {
    flex: 1
  },
  content: {
    flex: 1,
    justifyContent: "center",
    padding: 24
  },
  brand: {
    color: "#12221d",
    fontSize: 42,
    fontWeight: "800",
    letterSpacing: 0,
    textAlign: "center"
  },
  subtitle: {
    color: "#51635e",
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 28,
    marginTop: 8,
    textAlign: "center"
  },
  form: {
    backgroundColor: "#ffffff",
    borderColor: "#d9e5df",
    borderRadius: 8,
    borderWidth: 1,
    padding: 18,
    shadowColor: "#12221d",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 24
  },
  label: {
    color: "#243a33",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 12
  },
  input: {
    backgroundColor: "#f7faf8",
    borderColor: "#c9d9d2",
    borderRadius: 8,
    borderWidth: 1,
    color: "#10201b",
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14
  },
  error: {
    color: "#b84031",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12
  },
  loginButton: {
    alignItems: "center",
    backgroundColor: "#143f37",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 18,
    minHeight: 52
  },
  loginText: {
    color: "#f8faf7",
    fontSize: 16,
    fontWeight: "800"
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }]
  },
  buttonDisabled: {
    opacity: 0.78
  }
});
