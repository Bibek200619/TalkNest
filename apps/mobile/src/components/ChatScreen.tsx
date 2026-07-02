import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import { io, type Socket } from "socket.io-client";
import {
  AtSign,
  LogOut,
  MessageCircle,
  Send,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react-native";
import { fetchMessages, fetchUsers, resolveDirectConversation } from "../api";
import { ROOM_ID, SOCKET_URL } from "../config";
import type {
  ChatMessage,
  ConnectionState,
  PublicUser,
  Session,
} from "../types";
import { MessageBubble } from "./MessageBubble";

type Props = {
  session: Session;
  onLogout: () => Promise<void>;
};

type ConversationView =
  | {
      kind: "lobby";
      roomId: string;
      title: string;
      subtitle: string;
      participant?: never;
    }
  | {
      kind: "direct";
      roomId: string;
      title: string;
      subtitle: string;
      participant: PublicUser;
    };

type SendAck =
  { ok: true; message: ChatMessage } | { ok: false; error: string };

type RoomJoinAck = { ok: true; roomId: string } | { ok: false; error: string };

const lobbyConversation: ConversationView = {
  kind: "lobby",
  roomId: ROOM_ID,
  title: "Lobby",
  subtitle: "Team room",
};

export function ChatScreen({ session, onLogout }: Props) {
  const [conversation, setConversation] =
    useState<ConversationView>(lobbyConversation);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [handleDraft, setHandleDraft] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const activeRoomRef = useRef(conversation.roomId);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    activeRoomRef.current = conversation.roomId;
  }, [conversation.roomId]);

  useEffect(() => {
    let active = true;

    fetchUsers(session.token)
      .then((nextUsers) => {
        if (active) {
          setUsers(nextUsers);
        }
      })
      .catch(() => {
        if (active) {
          setError("Unable to load handles.");
        }
      });

    return () => {
      active = false;
    };
  }, [session.token]);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setMessages([]);
    fetchMessages(session.token, conversation.roomId)
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
  }, [conversation.roomId, session.token]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      auth: { token: session.token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      transports: ["websocket"],
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
      if (message.roomId !== activeRoomRef.current) {
        return;
      }

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

  useEffect(() => {
    const socket = socketRef.current;

    if (connection !== "connected" || !socket?.connected) {
      return;
    }

    socket.emit(
      "room:join",
      { roomId: conversation.roomId },
      (ack: RoomJoinAck) => {
        if (!ack.ok) {
          setError(ack.error || "Unable to open conversation.");
        }
      },
    );
  }, [connection, conversation.roomId]);

  const visibleUsers = useMemo(
    () => users.filter((user) => user.id !== session.user.id),
    [session.user.id, users],
  );
  const canSend = draft.trim().length > 0 && !sending;
  const canOpenHandle = handleDraft.trim().length > 0 && !joining;
  const statusLabel = useMemo(() => connectionText(connection), [connection]);
  const emptyTitle =
    conversation.kind === "direct"
      ? `No messages with ${displayHandle(conversation.participant.handle)}`
      : "No messages yet";
  const emptyText =
    conversation.kind === "direct"
      ? "Send a personal message that only this handle can access."
      : "Start the room with a short note.";

  const handleOpenLobby = () => {
    setConversation(lobbyConversation);
    setHandleDraft("");
    setError(null);
  };

  const handleOpenDirectByUser = (user: PublicUser) => {
    void openDirectConversation(user.handle);
  };

  const handleOpenDirectFromDraft = () => {
    void openDirectConversation(handleDraft);
  };

  const openDirectConversation = async (handle: string) => {
    const normalizedHandle = normalizeHandleInput(handle);

    if (!normalizedHandle) {
      setError("Enter a handle to open a personal chat.");
      return;
    }

    if (normalizedHandle === session.user.handle) {
      setError("Choose another user's handle.");
      return;
    }

    setJoining(true);
    setError(null);

    try {
      const directConversation = await resolveDirectConversation(
        session.token,
        normalizedHandle,
      );
      setConversation({
        kind: "direct",
        roomId: directConversation.roomId,
        title: directConversation.participant.displayName,
        subtitle: displayHandle(directConversation.participant.handle),
        participant: directConversation.participant,
      });
      setHandleDraft("");
    } catch (apiError) {
      setError(
        apiError instanceof Error
          ? apiError.message
          : "Unable to open personal chat.",
      );
    } finally {
      setJoining(false);
    }
  };

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
    socket.emit(
      "message:send",
      { roomId: conversation.roomId, text },
      (ack: SendAck) => {
        setSending(false);

        if (!ack.ok) {
          setDraft(text);
          setError(ack.error || "Message failed to send.");
        }
      },
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: "padding", default: undefined })}
        style={styles.shell}
      >
        <View style={styles.header}>
          <View style={styles.headerTitle}>
            <Text style={styles.title}>TalkNest</Text>
            <Text style={styles.room}>{conversation.title}</Text>
            <Text style={styles.account}>
              {displayHandle(session.user.handle)}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <View
              style={[
                styles.status,
                connection === "connected" && styles.statusOn,
              ]}
            >
              {connection === "connected" ? (
                <Wifi color="#1f6f58" size={14} />
              ) : (
                <WifiOff color="#a04737" size={14} />
              )}
              <Text
                style={[
                  styles.statusText,
                  connection === "connected" && styles.statusTextOn,
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
                pressed ? styles.buttonPressed : null,
              ]}
            >
              <LogOut color="#243a33" size={20} strokeWidth={2.3} />
            </Pressable>
          </View>
        </View>

        <View style={styles.conversationTools}>
          <ScrollView
            contentContainerStyle={styles.threadList}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            <Pressable
              accessibilityRole="button"
              onPress={handleOpenLobby}
              style={({ pressed }) => [
                styles.threadChip,
                conversation.kind === "lobby" ? styles.threadChipActive : null,
                pressed ? styles.buttonPressed : null,
              ]}
            >
              <Users
                color={conversation.kind === "lobby" ? "#f8faf7" : "#1f4038"}
                size={16}
              />
              <Text
                style={[
                  styles.threadText,
                  conversation.kind === "lobby"
                    ? styles.threadTextActive
                    : null,
                ]}
              >
                Lobby
              </Text>
            </Pressable>

            {visibleUsers.map((user) => {
              const selected =
                conversation.kind === "direct" &&
                conversation.participant.id === user.id;

              return (
                <Pressable
                  accessibilityRole="button"
                  key={user.id}
                  onPress={() => handleOpenDirectByUser(user)}
                  style={({ pressed }) => [
                    styles.threadChip,
                    selected ? styles.threadChipActive : null,
                    pressed ? styles.buttonPressed : null,
                  ]}
                >
                  <AtSign color={selected ? "#f8faf7" : "#1f4038"} size={15} />
                  <Text
                    style={[
                      styles.threadText,
                      selected ? styles.threadTextActive : null,
                    ]}
                  >
                    {user.handle}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.handleBar}>
            <AtSign color="#43635a" size={18} />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={!joining}
              onChangeText={setHandleDraft}
              onSubmitEditing={handleOpenDirectFromDraft}
              placeholder="Open handle"
              placeholderTextColor="#788a84"
              returnKeyType="go"
              style={styles.handleInput}
              value={handleDraft}
            />
            <Pressable
              accessibilityRole="button"
              disabled={!canOpenHandle}
              onPress={handleOpenDirectFromDraft}
              style={({ pressed }) => [
                styles.openButton,
                pressed && canOpenHandle ? styles.buttonPressed : null,
                !canOpenHandle ? styles.openDisabled : null,
              ]}
            >
              {joining ? (
                <ActivityIndicator color="#f8faf7" />
              ) : (
                <MessageCircle color="#f8faf7" size={18} strokeWidth={2.4} />
              )}
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
              messages.length === 0 ? styles.emptyContainer : null,
            ]}
            data={messages}
            keyExtractor={(item) => item.id}
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: true })
            }
            ref={listRef}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                own={item.senderId === session.user.id}
              />
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>{emptyTitle}</Text>
                <Text style={styles.emptyText}>{emptyText}</Text>
              </View>
            }
          />
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.composer}>
          <TextInput
            multiline
            onChangeText={setDraft}
            placeholder={
              conversation.kind === "direct"
                ? `Message ${conversation.subtitle}`
                : "Message lobby"
            }
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
              !canSend ? styles.sendDisabled : null,
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

function displayHandle(handle: string) {
  return `@${normalizeHandleInput(handle)}`;
}

function normalizeHandleInput(handle: string) {
  return handle.trim().replace(/^@+/, "").toLowerCase();
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: "#f2f6f3",
    flex: 1,
  },
  shell: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderBottomColor: "#dce8e2",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    color: "#13231e",
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: 0,
  },
  room: {
    color: "#314940",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2,
  },
  account: {
    color: "#6b7d77",
    fontSize: 12,
    marginTop: 1,
  },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  status: {
    alignItems: "center",
    backgroundColor: "#f7e9e4",
    borderRadius: 999,
    flexDirection: "row",
    gap: 5,
    minHeight: 32,
    paddingHorizontal: 10,
  },
  statusOn: {
    backgroundColor: "#e0f0e9",
  },
  statusText: {
    color: "#a04737",
    fontSize: 12,
    fontWeight: "800",
  },
  statusTextOn: {
    color: "#1f6f58",
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: "#edf4f0",
    borderRadius: 8,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  conversationTools: {
    backgroundColor: "#ffffff",
    borderBottomColor: "#dce8e2",
    borderBottomWidth: 1,
    paddingBottom: 12,
    paddingTop: 10,
  },
  threadList: {
    gap: 8,
    paddingHorizontal: 14,
  },
  threadChip: {
    alignItems: "center",
    backgroundColor: "#edf4f0",
    borderColor: "#d2e1da",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    minHeight: 36,
    paddingHorizontal: 11,
  },
  threadChipActive: {
    backgroundColor: "#143f37",
    borderColor: "#143f37",
  },
  threadText: {
    color: "#1f4038",
    fontSize: 13,
    fontWeight: "800",
  },
  threadTextActive: {
    color: "#f8faf7",
  },
  handleBar: {
    alignItems: "center",
    backgroundColor: "#f2f6f3",
    borderColor: "#d1ded8",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 14,
    marginTop: 10,
    minHeight: 46,
    paddingLeft: 12,
    paddingRight: 6,
  },
  handleInput: {
    color: "#10201b",
    flex: 1,
    fontSize: 15,
    minHeight: 42,
    paddingVertical: 8,
  },
  openButton: {
    alignItems: "center",
    backgroundColor: "#143f37",
    borderRadius: 8,
    height: 34,
    justifyContent: "center",
    width: 42,
  },
  openDisabled: {
    opacity: 0.45,
  },
  center: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  messages: {
    padding: 14,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  empty: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  emptyTitle: {
    color: "#263a34",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyText: {
    color: "#64746f",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
    textAlign: "center",
  },
  error: {
    color: "#a33f32",
    fontSize: 13,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  composer: {
    alignItems: "flex-end",
    backgroundColor: "#ffffff",
    borderTopColor: "#dce8e2",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12,
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
    paddingVertical: 12,
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: "#143f37",
    borderRadius: 8,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  sendDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    transform: [{ scale: 0.97 }],
  },
});
