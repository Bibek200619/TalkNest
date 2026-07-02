import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { io, type Socket } from "socket.io-client";
import { LogOut, Send, Wifi, WifiOff } from "lucide-react-native";
import { fetchMessages } from "../api";
import { ROOM_ID, SOCKET_URL } from "../config";
import type { ChatMessage, ConnectionState, Session } from "../types";
import { MessageBubble } from "./MessageBubble";

type Props = {
  session: Session;
  onLogout: () => Promise<void>;
};

type SendAck =
  | { ok: true; message: ChatMessage }
  | { ok: false; error: string };

export function ChatScreen({ session, onLogout }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let active = true;

    fetchMessages(session.token)
      .then((history) => {
        if (active) {
          setMessages(history);
        }
      })
      .catch(() => {
        if (active) {
          setError("Unable to load messages.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [session.token]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      auth: { token: session.token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      transports: ["websocket"]
    });

    socketRef.current = socket;
    setConnection("connecting");

    socket.on("connect", () => {
      setConnection("connected");
      setError(null);
    });
    socket.on("disconnect", () => {
      setConnection("disconnected");
    });
    socket.on("connect_error", () => {
      setConnection("error");
      setError("Unable to connect to server.");
    });
    socket.io.on("reconnect_attempt", () => {
      setConnection("reconnecting");
    });
    socket.on("message:new", (message: ChatMessage) => {
      setMessages((current) => {
        if (current.some((item) => item.id === message.id)) {
          return current;
        }

        return [...current, message];
      });
    });

    return () => {
      socket.removeAllListeners();
      socket.io.removeAllListeners();
      socket.close();
      socketRef.current = null;
    };
  }, [session.token]);

  const canSend = draft.trim().length > 0 && !sending;
  const statusLabel = useMemo(() => connectionText(connection), [connection]);

  const handleSend = () => {
    const text = draft.trim();

    if (!text) {
      setError("Message cannot be empty.");
      return;
    }

    const socket = socketRef.current;

    if (!socket || !socket.connected) {
      setError("Message failed to send.");
      return;
    }

    setSending(true);
    setDraft("");
    socket.emit("message:send", { roomId: ROOM_ID, text }, (ack: SendAck) => {
      setSending(false);

      if (!ack.ok) {
        setDraft(text);
        setError(ack.error || "Message failed to send.");
      }
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: "padding", default: undefined })}
        style={styles.shell}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>TalkNest</Text>
            <Text style={styles.room}>Lobby</Text>
          </View>
          <View style={styles.headerActions}>
            <View style={[styles.status, connection === "connected" && styles.statusOn]}>
              {connection === "connected" ? (
                <Wifi color="#1f6f58" size={14} />
              ) : (
                <WifiOff color="#a04737" size={14} />
              )}
              <Text
                style={[
                  styles.statusText,
                  connection === "connected" && styles.statusTextOn
                ]}
              >
                {statusLabel}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onLogout}
              style={({ pressed }) => [
                styles.iconButton,
                pressed ? styles.buttonPressed : null
              ]}
            >
              <LogOut color="#243a33" size={20} strokeWidth={2.3} />
            </Pressable>
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#143f37" />
          </View>
        ) : (
          <FlatList
            contentContainerStyle={[
              styles.messages,
              messages.length === 0 ? styles.emptyContainer : null
            ]}
            data={messages}
            keyExtractor={(item) => item.id}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            ref={listRef}
            renderItem={({ item }) => (
              <MessageBubble message={item} own={item.senderId === session.user.id} />
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptyText}>Start the room with a short note.</Text>
              </View>
            }
          />
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.composer}>
          <TextInput
            multiline
            onChangeText={setDraft}
            placeholder="Message"
            placeholderTextColor="#788a84"
            style={styles.messageInput}
            value={draft}
          />
          <Pressable
            accessibilityRole="button"
            disabled={!canSend}
            onPress={handleSend}
            style={({ pressed }) => [
              styles.sendButton,
              pressed && canSend ? styles.buttonPressed : null,
              !canSend ? styles.sendDisabled : null
            ]}
          >
            {sending ? (
              <ActivityIndicator color="#f8faf7" />
            ) : (
              <Send color="#f8faf7" size={20} strokeWidth={2.4} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function connectionText(connection: ConnectionState) {
  switch (connection) {
    case "connected":
      return "Online";
    case "connecting":
      return "Connecting";
    case "reconnecting":
      return "Reconnecting";
    case "error":
      return "Offline";
    case "disconnected":
      return "Disconnected";
  }
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: "#f2f6f3",
    flex: 1
  },
  shell: {
    flex: 1
  },
  header: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderBottomColor: "#dce8e2",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  title: {
    color: "#13231e",
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: 0
  },
  room: {
    color: "#6b7d77",
    fontSize: 13,
    marginTop: 2
  },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  status: {
    alignItems: "center",
    backgroundColor: "#f7e9e4",
    borderRadius: 999,
    flexDirection: "row",
    gap: 5,
    minHeight: 32,
    paddingHorizontal: 10
  },
  statusOn: {
    backgroundColor: "#e0f0e9"
  },
  statusText: {
    color: "#a04737",
    fontSize: 12,
    fontWeight: "800"
  },
  statusTextOn: {
    color: "#1f6f58"
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: "#edf4f0",
    borderRadius: 8,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  center: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center"
  },
  messages: {
    padding: 14
  },
  emptyContainer: {
    flexGrow: 1
  },
  empty: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28
  },
  emptyTitle: {
    color: "#263a34",
    fontSize: 18,
    fontWeight: "800"
  },
  emptyText: {
    color: "#64746f",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
    textAlign: "center"
  },
  error: {
    color: "#a33f32",
    fontSize: 13,
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  composer: {
    alignItems: "flex-end",
    backgroundColor: "#ffffff",
    borderTopColor: "#dce8e2",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12
  },
  messageInput: {
    backgroundColor: "#f2f6f3",
    borderColor: "#d1ded8",
    borderRadius: 8,
    borderWidth: 1,
    color: "#10201b",
    flex: 1,
    fontSize: 16,
    maxHeight: 112,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: "#143f37",
    borderRadius: 8,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  sendDisabled: {
    opacity: 0.45
  },
  buttonPressed: {
    transform: [{ scale: 0.97 }]
  }
});
