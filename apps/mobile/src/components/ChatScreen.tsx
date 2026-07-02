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
  useWindowDimensions,
  View,
} from "react-native";
import { io, type Socket } from "socket.io-client";
import {
  AtSign,
  Hash,
  LogOut,
  MessageCircle,
  Search,
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
  subtitle: "Shared room",
};

export function ChatScreen({ session, onLogout }: Props) {
  const { width } = useWindowDimensions();
  const compact = width < 760;
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
          setError("Unable to load contacts.");
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
      ? "Send a private message in this personal thread."
      : "Start the shared room with a short note.";

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
        style={styles.keyboard}
      >
        <View
          style={[styles.appShell, compact ? styles.appShellCompact : null]}
        >
          <View
            style={[styles.sidebar, compact ? styles.sidebarCompact : null]}
          >
            <View style={styles.sidebarHeader}>
              <View>
                <Text style={styles.brand}>TalkNest</Text>
                <Text style={styles.accountHandle}>
                  {displayHandle(session.user.handle)}
                </Text>
              </View>
              <View
                style={[
                  styles.statusDot,
                  connection === "connected" ? styles.statusDotOn : null,
                ]}
              >
                {connection === "connected" ? (
                  <Wifi color="#1f6f58" size={15} />
                ) : (
                  <WifiOff color="#a04737" size={15} />
                )}
              </View>
            </View>

            <View style={styles.handleSearch}>
              <Search color="#557168" size={18} />
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                editable={!joining}
                onChangeText={setHandleDraft}
                onSubmitEditing={handleOpenDirectFromDraft}
                placeholder="Search or enter handle"
                placeholderTextColor="#7a8e86"
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
                  <ActivityIndicator color="#f8faf7" size="small" />
                ) : (
                  <MessageCircle color="#f8faf7" size={17} strokeWidth={2.4} />
                )}
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.conversationList}
              showsVerticalScrollIndicator={false}
            >
              <ConversationRow
                active={conversation.kind === "lobby"}
                icon="lobby"
                onPress={handleOpenLobby}
                subtitle="Shared room"
                title="Lobby"
              />

              {visibleUsers.map((user) => (
                <ConversationRow
                  active={
                    conversation.kind === "direct" &&
                    conversation.participant.id === user.id
                  }
                  icon="direct"
                  key={user.id}
                  onPress={() => handleOpenDirectByUser(user)}
                  subtitle={displayHandle(user.handle)}
                  title={user.displayName}
                />
              ))}

              {visibleUsers.length === 0 ? (
                <View style={styles.noContacts}>
                  <Text style={styles.noContactsTitle}>No contacts yet</Text>
                  <Text style={styles.noContactsText}>
                    Ask another user to create an account, then open their
                    handle here.
                  </Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.sidebarFooter}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {session.user.displayName.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={styles.footerUser}>
                <Text style={styles.footerName}>
                  {session.user.displayName}
                </Text>
                <Text style={styles.footerStatus}>{statusLabel}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={onLogout}
                style={({ pressed }) => [
                  styles.logoutButton,
                  pressed ? styles.buttonPressed : null,
                ]}
              >
                <LogOut color="#243a33" size={19} strokeWidth={2.3} />
              </Pressable>
            </View>
          </View>

          <View style={styles.chatPanel}>
            <View style={styles.chatHeader}>
              <View style={styles.chatTitleBlock}>
                <Text style={styles.chatTitle}>{conversation.title}</Text>
                <Text style={styles.chatSubtitle}>{conversation.subtitle}</Text>
              </View>
              <View
                style={[
                  styles.statusPill,
                  connection === "connected" ? styles.statusPillOn : null,
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
                    connection === "connected" ? styles.statusTextOn : null,
                  ]}
                >
                  {statusLabel}
                </Text>
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
                    <Users color="#6f8c83" size={28} />
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
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type ConversationRowProps = {
  active: boolean;
  icon: "lobby" | "direct";
  onPress: () => void;
  subtitle: string;
  title: string;
};

function ConversationRow({
  active,
  icon,
  onPress,
  subtitle,
  title,
}: ConversationRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.conversationRow,
        active ? styles.conversationRowActive : null,
        pressed ? styles.buttonPressed : null,
      ]}
    >
      <View style={[styles.rowAvatar, active ? styles.rowAvatarActive : null]}>
        {icon === "lobby" ? (
          <Hash color={active ? "#f8faf7" : "#36584f"} size={18} />
        ) : (
          <AtSign color={active ? "#f8faf7" : "#36584f"} size={18} />
        )}
      </View>
      <View style={styles.rowText}>
        <Text
          numberOfLines={1}
          style={[styles.rowTitle, active ? styles.rowTitleActive : null]}
        >
          {title}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.rowSubtitle, active ? styles.rowSubtitleActive : null]}
        >
          {subtitle}
        </Text>
      </View>
    </Pressable>
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
    backgroundColor: "#e6ede9",
    flex: 1,
  },
  keyboard: {
    flex: 1,
  },
  appShell: {
    backgroundColor: "#f6faf7",
    flex: 1,
    flexDirection: "row",
  },
  appShellCompact: {
    flexDirection: "column",
  },
  sidebar: {
    backgroundColor: "#ffffff",
    borderRightColor: "#d4e2dc",
    borderRightWidth: 1,
    maxWidth: 380,
    minWidth: 310,
    width: "32%",
  },
  sidebarCompact: {
    borderBottomColor: "#d4e2dc",
    borderBottomWidth: 1,
    borderRightWidth: 0,
    maxHeight: 300,
    maxWidth: "100%",
    minWidth: 0,
    width: "100%",
  },
  sidebarHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 76,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  brand: {
    color: "#13231e",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 0,
  },
  accountHandle: {
    color: "#6a7d76",
    fontSize: 13,
    marginTop: 2,
  },
  statusDot: {
    alignItems: "center",
    backgroundColor: "#f7e9e4",
    borderRadius: 8,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  statusDotOn: {
    backgroundColor: "#e0f0e9",
  },
  handleSearch: {
    alignItems: "center",
    backgroundColor: "#f2f6f3",
    borderColor: "#d5e2dc",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 12,
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
    width: 40,
  },
  openDisabled: {
    opacity: 0.45,
  },
  conversationList: {
    gap: 4,
    paddingBottom: 14,
    paddingHorizontal: 10,
  },
  conversationRow: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 10,
  },
  conversationRowActive: {
    backgroundColor: "#e6f1ec",
  },
  rowAvatar: {
    alignItems: "center",
    backgroundColor: "#edf4f0",
    borderRadius: 8,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  rowAvatarActive: {
    backgroundColor: "#143f37",
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    color: "#152720",
    fontSize: 15,
    fontWeight: "800",
  },
  rowTitleActive: {
    color: "#10201b",
  },
  rowSubtitle: {
    color: "#6e807a",
    fontSize: 13,
    marginTop: 3,
  },
  rowSubtitleActive: {
    color: "#3d6258",
  },
  noContacts: {
    padding: 14,
  },
  noContactsTitle: {
    color: "#263a34",
    fontSize: 14,
    fontWeight: "800",
  },
  noContactsText: {
    color: "#697b75",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  sidebarFooter: {
    alignItems: "center",
    borderTopColor: "#dce8e2",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 68,
    paddingHorizontal: 14,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: "#143f37",
    borderRadius: 8,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  avatarText: {
    color: "#f8faf7",
    fontSize: 16,
    fontWeight: "800",
  },
  footerUser: {
    flex: 1,
    minWidth: 0,
  },
  footerName: {
    color: "#13231e",
    fontSize: 14,
    fontWeight: "800",
  },
  footerStatus: {
    color: "#6d8079",
    fontSize: 12,
    marginTop: 2,
  },
  logoutButton: {
    alignItems: "center",
    backgroundColor: "#edf4f0",
    borderRadius: 8,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  chatPanel: {
    backgroundColor: "#f2f6f3",
    flex: 1,
  },
  chatHeader: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderBottomColor: "#dce8e2",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 76,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  chatTitleBlock: {
    flex: 1,
    paddingRight: 12,
  },
  chatTitle: {
    color: "#13231e",
    fontSize: 20,
    fontWeight: "800",
  },
  chatSubtitle: {
    color: "#657871",
    fontSize: 13,
    marginTop: 2,
  },
  statusPill: {
    alignItems: "center",
    backgroundColor: "#f7e9e4",
    borderRadius: 999,
    flexDirection: "row",
    gap: 5,
    minHeight: 32,
    paddingHorizontal: 10,
  },
  statusPillOn: {
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
  center: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  messages: {
    padding: 18,
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
    marginTop: 10,
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
    paddingHorizontal: 18,
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
