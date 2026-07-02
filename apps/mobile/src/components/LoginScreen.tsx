import { useMemo, useState } from "react";
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
  type TextInputProps,
  useWindowDimensions,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  AtSign,
  Lock,
  LogIn,
  Mail,
  MessageCircle,
  Moon,
  Sun,
  User,
  UserPlus,
} from "lucide-react-native";
import type { AppTheme, RegisterInput } from "../types";

type Props = {
  error: string | null;
  loading: boolean;
  onLogin: (identifier: string, password: string) => Promise<void>;
  onRegister: (input: RegisterInput) => Promise<void>;
  onToggleTheme: () => void;
  theme: AppTheme;
};

type Mode = "login" | "register";
type FieldIcon = "at" | "lock" | "mail" | "user";

export function LoginScreen({
  error,
  loading,
  onLogin,
  onRegister,
  onToggleTheme,
  theme,
}: Props) {
  const { width } = useWindowDimensions();
  const wide = width >= 920;
  const styles = useMemo(() => createStyles(theme), [theme]);
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
  const gradient: readonly [string, string] =
    theme === "dark" ? ["#111827", "#172554"] : ["#eef2ff", "#ffffff"];

  return (
    <LinearGradient colors={gradient} style={styles.shell}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.select({ ios: "padding", default: undefined })}
          style={styles.keyboard}
        >
          <ScrollView
            contentContainerStyle={[
              styles.content,
              wide ? styles.contentWide : null,
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.authFrame, wide ? styles.authFrameWide : null]}>
              <View style={[styles.formPanel, wide ? styles.formPanelWide : null]}>
                <View style={styles.logoRow}>
                  <View style={styles.logoMark}>
                    <MessageCircle color="#ffffff" size={19} strokeWidth={2.6} />
                  </View>
                  <Text style={styles.logoText}>TalkNest</Text>
                  <Pressable
                    accessibilityLabel="Toggle dark theme"
                    accessibilityRole="button"
                    onPress={onToggleTheme}
                    style={({ pressed }) => [
                      styles.themeButton,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    {theme === "dark" ? (
                      <Sun color="#facc15" size={18} strokeWidth={2.2} />
                    ) : (
                      <Moon color="#4338ca" size={18} strokeWidth={2.2} />
                    )}
                  </Pressable>
                </View>

                <Text style={styles.heading}>
                  {mode === "register" ? "Register" : "Welcome back"}
                </Text>
                <Text style={styles.subheading}>
                  {mode === "register"
                    ? "Sign up to share moments with friends."
                    : "Sign in with your handle, username, or email."}
                </Text>

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
                      Sign Up
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
                      Sign In
                    </Text>
                  </Pressable>
                </View>

                {mode === "register" ? (
                  <>
                    <Field
                      editable={!loading}
                      icon="user"
                      label="Display Name"
                      onChangeText={setDisplayName}
                      placeholder="Your name"
                      styles={styles}
                      value={displayName}
                    />
                    <Field
                      autoCapitalize="none"
                      editable={!loading}
                      icon="user"
                      label="User Name"
                      onChangeText={setUsername}
                      placeholder="yourname"
                      styles={styles}
                      value={username}
                    />
                    <Field
                      autoCapitalize="none"
                      editable={!loading}
                      icon="at"
                      label="Handle"
                      onChangeText={setHandle}
                      placeholder="@yourhandle"
                      styles={styles}
                      value={handle}
                    />
                    <Field
                      autoCapitalize="none"
                      editable={!loading}
                      icon="mail"
                      keyboardType="email-address"
                      label="Email"
                      onChangeText={setEmail}
                      placeholder="you@example.com"
                      styles={styles}
                      value={email}
                    />
                  </>
                ) : (
                  <Field
                    autoCapitalize="none"
                    editable={!loading}
                    icon="at"
                    label="Username, Handle, or Email"
                    onChangeText={setIdentifier}
                    placeholder="@yourhandle"
                    styles={styles}
                    value={identifier}
                  />
                )}

                <Field
                  editable={!loading}
                  icon="lock"
                  label="Password"
                  onChangeText={setPassword}
                  onSubmitEditing={handleSubmit}
                  placeholder="Minimum 8 characters"
                  secureTextEntry
                  styles={styles}
                  value={password}
                />

                {activeError ? (
                  <Text accessibilityLiveRegion="polite" style={styles.error}>
                    {activeError}
                  </Text>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  disabled={loading}
                  onPress={handleSubmit}
                  style={({ pressed }) => [
                    styles.submitButton,
                    pressed && !loading ? styles.pressed : null,
                    loading ? styles.disabled : null,
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <>
                      {mode === "register" ? (
                        <UserPlus color="#ffffff" size={19} strokeWidth={2.5} />
                      ) : (
                        <LogIn color="#ffffff" size={19} strokeWidth={2.5} />
                      )}
                      <Text style={styles.submitText}>
                        {mode === "register" ? "Sign Up" : "Sign In"}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>

              <LinearGradient
                colors={["#8b5cf6", "#5b21b6", "#312e81"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.previewPanel,
                  wide ? styles.previewPanelWide : null,
                ]}
              >
                <View style={styles.previewBadge}>
                  <Text style={styles.previewBadgeText}>private handles</Text>
                </View>
                <View style={styles.previewAvatarLeft}>
                  <Text style={styles.previewAvatarText}>A</Text>
                </View>
                <View style={styles.previewAvatarRight}>
                  <Text style={styles.previewAvatarText}>N</Text>
                </View>
                <View style={styles.previewStack}>
                  <View style={styles.previewTopbar}>
                    <View style={styles.previewIcon} />
                    <View style={styles.previewLineLong} />
                    <View style={styles.previewLineShort} />
                  </View>
                  <View style={styles.previewBody}>
                    <View style={styles.previewList}>
                      {["Maya", "Noah", "Ira"].map((name, index) => (
                        <View key={name} style={styles.previewContact}>
                          <View
                            style={[
                              styles.previewContactAvatar,
                              index === 1 ? styles.previewContactAvatarBlue : null,
                            ]}
                          />
                          <View style={styles.previewContactText}>
                            <Text style={styles.previewContactName}>{name}</Text>
                            <View style={styles.previewContactLine} />
                          </View>
                        </View>
                      ))}
                    </View>
                    <View style={styles.previewChat}>
                      <View style={styles.previewBubbleOwn} />
                      <View style={styles.previewBubbleOther} />
                      <View style={styles.previewGallery}>
                        <View style={styles.previewTile} />
                        <View style={styles.previewTileAlt} />
                        <View style={styles.previewTile} />
                      </View>
                      <View style={styles.previewComposer} />
                    </View>
                  </View>
                </View>
              </LinearGradient>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

type FieldProps = {
  autoCapitalize?: TextInputProps["autoCapitalize"];
  editable?: boolean;
  icon: FieldIcon;
  keyboardType?: TextInputProps["keyboardType"];
  label: string;
  onChangeText: (text: string) => void;
  onSubmitEditing?: () => void;
  placeholder: string;
  secureTextEntry?: boolean;
  styles: ReturnType<typeof createStyles>;
  value: string;
};

function Field({
  autoCapitalize,
  editable,
  icon,
  keyboardType,
  label,
  onChangeText,
  onSubmitEditing,
  placeholder,
  secureTextEntry,
  styles,
  value,
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        {renderIcon(icon, styles.icon.color)}
        <TextInput
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          editable={editable}
          keyboardType={keyboardType}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
          placeholder={placeholder}
          placeholderTextColor={styles.placeholder.color}
          returnKeyType={onSubmitEditing ? "send" : "next"}
          secureTextEntry={secureTextEntry}
          style={styles.input}
          value={value}
        />
      </View>
    </View>
  );
}

function renderIcon(icon: FieldIcon, color: string) {
  const iconProps = { color, size: 16, strokeWidth: 2.2 };

  switch (icon) {
    case "at":
      return <AtSign {...iconProps} />;
    case "lock":
      return <Lock {...iconProps} />;
    case "mail":
      return <Mail {...iconProps} />;
    case "user":
      return <User {...iconProps} />;
  }
}

function createStyles(theme: AppTheme) {
  const dark = theme === "dark";
  const text = dark ? "#f8fafc" : "#111827";
  const muted = dark ? "#aab4c8" : "#64748b";
  const panel = dark ? "#111827" : "#ffffff";
  const field = dark ? "#1f2937" : "#ffffff";
  const border = dark ? "#374151" : "#e2e8f0";

  return StyleSheet.create({
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
      padding: 18,
    },
    contentWide: {
      padding: 44,
    },
    authFrame: {
      alignSelf: "center",
      backgroundColor: panel,
      borderColor: border,
      borderRadius: 8,
      borderWidth: 1,
      maxWidth: 1120,
      overflow: "hidden",
      boxShadow: dark
        ? "0 24px 36px rgba(15, 23, 42, 0.35)"
        : "0 24px 36px rgba(30, 27, 75, 0.14)",
      width: "100%",
    },
    authFrameWide: {
      flexDirection: "row",
      minHeight: 620,
    },
    formPanel: {
      padding: 24,
    },
    formPanelWide: {
      flex: 0.46,
      paddingHorizontal: 40,
      paddingVertical: 34,
    },
    logoRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 9,
      marginBottom: 28,
    },
    logoMark: {
      alignItems: "center",
      backgroundColor: "#7c3aed",
      borderRadius: 8,
      height: 34,
      justifyContent: "center",
      width: 34,
    },
    logoText: {
      color: text,
      flex: 1,
      fontSize: 20,
      fontWeight: "800",
      letterSpacing: 0,
    },
    themeButton: {
      alignItems: "center",
      backgroundColor: dark ? "#1f2937" : "#eef2ff",
      borderColor: border,
      borderRadius: 8,
      borderWidth: 1,
      height: 38,
      justifyContent: "center",
      width: 38,
    },
    heading: {
      color: text,
      fontSize: 28,
      fontWeight: "800",
      letterSpacing: 0,
    },
    subheading: {
      color: muted,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 5,
    },
    modeSwitch: {
      backgroundColor: dark ? "#1f2937" : "#f1f5f9",
      borderRadius: 8,
      flexDirection: "row",
      gap: 4,
      marginTop: 22,
      padding: 4,
    },
    modeButton: {
      alignItems: "center",
      borderRadius: 7,
      flex: 1,
      justifyContent: "center",
      minHeight: 38,
    },
    modeButtonActive: {
      backgroundColor: "#7c3aed",
    },
    modeText: {
      color: muted,
      fontSize: 13,
      fontWeight: "800",
    },
    modeTextActive: {
      color: "#ffffff",
    },
    field: {
      marginTop: 14,
    },
    label: {
      color: text,
      fontSize: 12,
      fontWeight: "800",
      marginBottom: 7,
    },
    inputWrap: {
      alignItems: "center",
      backgroundColor: field,
      borderColor: border,
      borderRadius: 7,
      borderWidth: 1,
      flexDirection: "row",
      gap: 9,
      minHeight: 44,
      paddingHorizontal: 12,
    },
    input: {
      color: text,
      flex: 1,
      fontSize: 14,
      minHeight: 42,
      paddingVertical: 8,
    },
    icon: {
      color: dark ? "#a78bfa" : "#64748b",
    },
    placeholder: {
      color: dark ? "#64748b" : "#94a3b8",
    },
    error: {
      color: dark ? "#fca5a5" : "#b91c1c",
      fontSize: 13,
      lineHeight: 18,
      marginTop: 12,
    },
    submitButton: {
      alignItems: "center",
      backgroundColor: "#7c3aed",
      borderRadius: 7,
      flexDirection: "row",
      gap: 8,
      justifyContent: "center",
      marginTop: 18,
      minHeight: 48,
      boxShadow: "0 12px 18px rgba(124, 58, 237, 0.26)",
    },
    submitText: {
      color: "#ffffff",
      fontSize: 15,
      fontWeight: "800",
    },
    previewPanel: {
      minHeight: 360,
      overflow: "hidden",
      padding: 28,
    },
    previewPanelWide: {
      flex: 0.54,
      justifyContent: "center",
      padding: 48,
    },
    previewBadge: {
      alignSelf: "flex-start",
      backgroundColor: "rgba(255,255,255,0.16)",
      borderColor: "rgba(255,255,255,0.26)",
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    previewBadgeText: {
      color: "#f5f3ff",
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    previewAvatarLeft: {
      alignItems: "center",
      backgroundColor: "#67e8f9",
      borderColor: "rgba(255,255,255,0.58)",
      borderRadius: 8,
      borderWidth: 2,
      height: 42,
      justifyContent: "center",
      left: 52,
      position: "absolute",
      top: 88,
      width: 42,
    },
    previewAvatarRight: {
      alignItems: "center",
      backgroundColor: "#fbbf24",
      borderColor: "rgba(255,255,255,0.58)",
      borderRadius: 8,
      borderWidth: 2,
      height: 42,
      justifyContent: "center",
      position: "absolute",
      right: 58,
      top: 58,
      width: 42,
    },
    previewAvatarText: {
      color: "#312e81",
      fontSize: 15,
      fontWeight: "900",
    },
    previewStack: {
      alignSelf: "center",
      backgroundColor: "rgba(255,255,255,0.18)",
      borderColor: "rgba(255,255,255,0.3)",
      borderRadius: 8,
      borderWidth: 1,
      marginTop: 64,
      maxWidth: 520,
      padding: 10,
      transform: [{ rotate: "-2deg" }],
      width: "100%",
    },
    previewTopbar: {
      alignItems: "center",
      backgroundColor: "#ffffff",
      borderTopLeftRadius: 6,
      borderTopRightRadius: 6,
      flexDirection: "row",
      gap: 8,
      minHeight: 34,
      paddingHorizontal: 12,
    },
    previewIcon: {
      backgroundColor: "#7c3aed",
      borderRadius: 4,
      height: 14,
      width: 14,
    },
    previewLineLong: {
      backgroundColor: "#dbeafe",
      borderRadius: 4,
      flex: 1,
      height: 8,
    },
    previewLineShort: {
      backgroundColor: "#c4b5fd",
      borderRadius: 4,
      height: 8,
      width: 56,
    },
    previewBody: {
      backgroundColor: "#f8fafc",
      borderBottomLeftRadius: 6,
      borderBottomRightRadius: 6,
      flexDirection: "row",
      gap: 10,
      minHeight: 230,
      padding: 12,
    },
    previewList: {
      gap: 10,
      width: "36%",
    },
    previewContact: {
      alignItems: "center",
      backgroundColor: "#ffffff",
      borderColor: "#e2e8f0",
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: "row",
      gap: 8,
      minHeight: 48,
      paddingHorizontal: 8,
    },
    previewContactAvatar: {
      backgroundColor: "#fb7185",
      borderRadius: 7,
      height: 24,
      width: 24,
    },
    previewContactAvatarBlue: {
      backgroundColor: "#38bdf8",
    },
    previewContactText: {
      flex: 1,
      gap: 5,
    },
    previewContactName: {
      color: "#334155",
      fontSize: 10,
      fontWeight: "800",
    },
    previewContactLine: {
      backgroundColor: "#e2e8f0",
      borderRadius: 4,
      height: 6,
      width: "82%",
    },
    previewChat: {
      backgroundColor: "#ffffff",
      borderColor: "#e2e8f0",
      borderRadius: 8,
      borderWidth: 1,
      flex: 1,
      gap: 12,
      justifyContent: "center",
      padding: 14,
    },
    previewBubbleOwn: {
      alignSelf: "flex-end",
      backgroundColor: "#7c3aed",
      borderRadius: 8,
      height: 36,
      width: "74%",
    },
    previewBubbleOther: {
      alignSelf: "flex-start",
      backgroundColor: "#e0f2fe",
      borderRadius: 8,
      height: 30,
      width: "54%",
    },
    previewGallery: {
      flexDirection: "row",
      gap: 8,
    },
    previewTile: {
      backgroundColor: "#c4b5fd",
      borderRadius: 7,
      flex: 1,
      height: 44,
    },
    previewTileAlt: {
      backgroundColor: "#38bdf8",
      borderRadius: 7,
      flex: 1,
      height: 44,
    },
    previewComposer: {
      backgroundColor: "#f1f5f9",
      borderRadius: 8,
      height: 34,
    },
    pressed: {
      transform: [{ scale: 0.98 }],
    },
    disabled: {
      opacity: 0.72,
    },
  });
}
