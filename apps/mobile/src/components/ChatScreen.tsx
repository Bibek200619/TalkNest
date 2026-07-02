import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import * as DocumentPicker from "expo-document-picker";
import { io, type Socket } from "socket.io-client";
import {
  AtSign,
  Bell,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  Hash,
  Home,
  Image as ImageIcon,
  LogOut,
  MessageCircle,
  Moon,
  MoreVertical,
  Paperclip,
  Plus,
  Save,
  Search,
  Send,
  Settings,
  Smile,
  Sun,
  User,
  Users,
  Video,
  Wifi,
  WifiOff,
  X,
} from "lucide-react-native";
import { fetchMessages, fetchUsers, resolveDirectConversation } from "../api";
import { ROOM_ID, SOCKET_URL } from "../config";
import type {
  AppTheme,
  AttachmentKind,
  ChatAttachment,
  ChatMessage,
  ConnectionState,
  ProfileUpdateInput,
  PublicUser,
  Session,
} from "../types";
import { MessageBubble } from "./MessageBubble";

type Props = {
  session: Session;
  onLogout: () => Promise<void>;
  onToggleTheme: () => void;
  onUpdateProfile: (input: ProfileUpdateInput) => Promise<Session>;
  theme: AppTheme;
};

type AppSection =
  | "home"
  | "chat"
  | "contacts"
  | "notifications"
  | "calendar"
  | "settings";

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
  | { ok: true; message: ChatMessage }
  | { ok: false; error: string };

type RoomJoinAck = { ok: true; roomId: string } | { ok: false; error: string };

type FileReaderLike = {
  error?: unknown;
  onerror: null | (() => void);
  onloadend: null | (() => void);
  result?: string | ArrayBuffer | null;
  readAsDataURL: (blob: unknown) => void;
};

type FileReaderConstructor = new () => FileReaderLike;

const lobbyConversation: ConversationView = {
  kind: "lobby",
  roomId: ROOM_ID,
  title: "Lobby",
  subtitle: "Shared room",
};

const attachmentLimits: Record<AttachmentKind, number> = {
  image: 4 * 1024 * 1024,
  video: 4 * 1024 * 1024,
  document: 2 * 1024 * 1024,
};

const allowedAttachmentMimeTypes: Record<AttachmentKind, string[]> = {
  image: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  video: ["video/mp4", "video/quicktime", "video/webm"],
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
  ],
};

export function ChatScreen({
  session,
  onLogout,
  onToggleTheme,
  onUpdateProfile,
  theme,
}: Props) {
  const { width } = useWindowDimensions();
  const compact = width < 900;
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [inboxCollapsed, setInboxCollapsed] = useState(false);
  const effectiveNavCollapsed = navCollapsed && !compact;
  const effectiveInboxCollapsed = inboxCollapsed && !compact;
  const styles = useMemo(
    () =>
      createStyles(
        theme,
        compact,
        effectiveNavCollapsed,
        effectiveInboxCollapsed,
      ),
    [compact, effectiveInboxCollapsed, effectiveNavCollapsed, theme],
  );
  const [conversation, setConversation] =
    useState<ConversationView>(lobbyConversation);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [activeSection, setActiveSection] = useState<AppSection>("chat");
  const [handleDraft, setHandleDraft] = useState("");
  const [draft, setDraft] = useState("");
  const [selectedAttachment, setSelectedAttachment] =
    useState<ChatAttachment | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [sending, setSending] = useState(false);
  const [pickingAttachment, setPickingAttachment] =
    useState<AttachmentKind | null>(null);
  const [profileDraft, setProfileDraft] = useState({
    displayName: session.user.displayName,
    username: session.user.username,
    handle: session.user.handle,
    email: session.user.email,
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const activeRoomRef = useRef(conversation.roomId);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    activeRoomRef.current = conversation.roomId;
  }, [conversation.roomId]);

  useEffect(() => {
    setProfileDraft({
      displayName: session.user.displayName,
      username: session.user.username,
      handle: session.user.handle,
      email: session.user.email,
    });
  }, [
    session.user.displayName,
    session.user.email,
    session.user.handle,
    session.user.username,
  ]);

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
  const canSend = (!!draft.trim() || !!selectedAttachment) && !sending;
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
    setActiveSection("home");
    setError(null);
  };

  const handleOpenDirectByUser = (user: PublicUser) => {
    setActiveSection("chat");
    void openDirectConversation(user.handle);
  };

  const handleOpenDirectFromDraft = () => {
    setActiveSection("chat");
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
    setActiveSection("chat");
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
    const attachment = selectedAttachment;

    if (!text && !attachment) {
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
    setSelectedAttachment(null);
    socket.emit(
      "message:send",
      { roomId: conversation.roomId, text, attachment },
      (ack: SendAck) => {
        setSending(false);

        if (!ack.ok) {
          setDraft(text);
          setSelectedAttachment(attachment);
          setError(ack.error || "Message failed to send.");
        }
      },
    );
  };

  const pickAttachment = async (kind: AttachmentKind) => {
    setPickingAttachment(kind);
    setError(null);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: allowedAttachmentMimeTypes[kind],
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];

      if (!asset) {
        return;
      }

      const mimeType = asset.mimeType ?? inferMimeType(asset.name);

      if (!allowedAttachmentMimeTypes[kind].includes(mimeType)) {
        setError("Unsupported attachment type.");
        return;
      }

      const file = await readAssetAsDataUrl(asset, mimeType);

      if (file.size > attachmentLimits[kind]) {
        setError(
          `${labelForAttachment(kind)} must be ${formatFileSize(
            attachmentLimits[kind],
          )} or smaller.`,
        );
        return;
      }

      setSelectedAttachment({
        kind,
        fileName: asset.name || `${kind}-attachment`,
        mimeType,
        size: file.size,
        dataUrl: normalizeDataUrl(file.dataUrl, mimeType),
      });
    } catch (pickError) {
      setError(
        pickError instanceof Error
          ? pickError.message
          : "Unable to attach this file.",
      );
    } finally {
      setPickingAttachment(null);
    }
  };

  const handleProfileDraftChange = (
    field: keyof typeof profileDraft,
    value: string,
  ) => {
    setSettingsNotice(null);
    setProfileDraft((current) => ({ ...current, [field]: value }));
  };

  const handleSaveProfile = async () => {
    const nextProfile = {
      displayName: profileDraft.displayName.trim(),
      username: profileDraft.username.trim(),
      handle: normalizeHandleInput(profileDraft.handle),
      email: profileDraft.email.trim(),
    };

    if (
      !nextProfile.displayName ||
      !nextProfile.username ||
      !nextProfile.handle ||
      !nextProfile.email
    ) {
      setSettingsNotice(null);
      setError("Complete all profile fields before saving.");
      return;
    }

    setSavingProfile(true);
    setError(null);
    setSettingsNotice(null);

    try {
      const nextSession = await onUpdateProfile(nextProfile);
      setUsers((current) =>
        current.map((user) =>
          user.id === nextSession.user.id ? nextSession.user : user,
        ),
      );
      setSettingsNotice("Profile updated.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to update profile.",
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSelectSection = (section: AppSection) => {
    setActiveSection(section);
    setError(null);

    if (section === "home") {
      setConversation(lobbyConversation);
      setHandleDraft("");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: "padding", default: undefined })}
        style={styles.keyboard}
      >
        <View style={styles.appShell}>
          <View style={styles.navRail}>
            {!compact ? (
              <Pressable
                accessibilityLabel={
                  effectiveNavCollapsed
                    ? "Expand navigation sidebar"
                    : "Collapse navigation sidebar"
                }
                accessibilityRole="button"
                onPress={() => setNavCollapsed((current) => !current)}
                style={({ pressed }) => [
                  styles.railCollapseButton,
                  pressed ? styles.pressed : null,
                ]}
              >
                {effectiveNavCollapsed ? (
                  <ChevronRight color={styles.navIcon.color} size={20} />
                ) : (
                  <ChevronLeft color={styles.navIcon.color} size={20} />
                )}
              </Pressable>
            ) : null}
            <View style={styles.profileBlock}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>
                  {session.user.displayName.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              {!compact && !effectiveNavCollapsed ? (
                <>
                  <Text numberOfLines={1} style={styles.profileName}>
                    {session.user.displayName}
                  </Text>
                  <Text numberOfLines={1} style={styles.profileHandle}>
                    {displayHandle(session.user.handle)}
                  </Text>
                </>
              ) : null}
            </View>

            <View style={styles.navItems}>
              <NavItem
                active={activeSection === "home"}
                compact={compact || effectiveNavCollapsed}
                icon={<Home color={styles.navIcon.color} size={18} />}
                label="Home"
                onPress={() => handleSelectSection("home")}
                styles={styles}
              />
              <NavItem
                active={activeSection === "chat"}
                compact={compact || effectiveNavCollapsed}
                icon={<MessageCircle color={styles.navIcon.color} size={18} />}
                label="Chat"
                onPress={() => handleSelectSection("chat")}
                styles={styles}
              />
              <NavItem
                active={activeSection === "contacts"}
                compact={compact || effectiveNavCollapsed}
                icon={<User color={styles.navIcon.color} size={18} />}
                label="Contact"
                onPress={() => handleSelectSection("contacts")}
                styles={styles}
              />
              <NavItem
                active={activeSection === "notifications"}
                compact={compact || effectiveNavCollapsed}
                icon={<Bell color={styles.navIcon.color} size={18} />}
                label="Notifications"
                onPress={() => handleSelectSection("notifications")}
                styles={styles}
              />
              <NavItem
                active={activeSection === "calendar"}
                compact={compact || effectiveNavCollapsed}
                icon={<Calendar color={styles.navIcon.color} size={18} />}
                label="Calendar"
                onPress={() => handleSelectSection("calendar")}
                styles={styles}
              />
              <NavItem
                active={activeSection === "settings"}
                compact={compact || effectiveNavCollapsed}
                icon={<Settings color={styles.navIcon.color} size={18} />}
                label="Settings"
                onPress={() => handleSelectSection("settings")}
                styles={styles}
              />
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={onLogout}
              style={({ pressed }) => [
                styles.logoutButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <LogOut color={styles.navIcon.color} size={19} strokeWidth={2.2} />
              {!compact && !effectiveNavCollapsed ? (
                <Text style={styles.logoutText}>Log Out</Text>
              ) : null}
            </Pressable>
          </View>

          <View style={styles.inboxPanel}>
            {effectiveInboxCollapsed ? (
              <View style={styles.inboxCollapsedContent}>
                <Pressable
                  accessibilityLabel="Expand chat list sidebar"
                  accessibilityRole="button"
                  onPress={() => setInboxCollapsed(false)}
                  style={({ pressed }) => [
                    styles.sidebarCollapseButton,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <ChevronRight color={styles.navIcon.color} size={22} />
                </Pressable>
                <MessageCircle color={styles.navIcon.color} size={22} />
              </View>
            ) : (
              <>
                <View style={styles.inboxHeader}>
                  <View>
                    <Text style={styles.inboxTitle}>
                      {sectionTitle(activeSection)}
                    </Text>
                    <Text style={styles.inboxSubtitle}>
                      {sectionSubtitle(activeSection)}
                    </Text>
                  </View>
                  <View style={styles.inboxHeaderActions}>
                    {activeSection === "chat" ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          setActiveSection("chat");
                          setHandleDraft("@");
                        }}
                        style={({ pressed }) => [
                          styles.newChatButton,
                          pressed ? styles.pressed : null,
                        ]}
                      >
                        <Plus color="#ffffff" size={17} strokeWidth={2.4} />
                        <Text style={styles.newChatText}>Create New Chat</Text>
                      </Pressable>
                    ) : null}
                    {!compact ? (
                      <Pressable
                        accessibilityLabel="Collapse chat list sidebar"
                        accessibilityRole="button"
                        onPress={() => setInboxCollapsed(true)}
                        style={({ pressed }) => [
                          styles.sidebarCollapseButton,
                          pressed ? styles.pressed : null,
                        ]}
                      >
                        <ChevronLeft color={styles.navIcon.color} size={22} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                {activeSection === "chat" ? (
                  <>
                    <View style={styles.searchRow}>
                      <Search color={styles.searchIcon.color} size={18} />
                      <TextInput
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!joining}
                        onChangeText={setHandleDraft}
                        onSubmitEditing={handleOpenDirectFromDraft}
                        placeholder="Search or enter handle"
                        placeholderTextColor={styles.placeholder.color}
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
                          pressed && canOpenHandle ? styles.pressed : null,
                          !canOpenHandle ? styles.disabled : null,
                        ]}
                      >
                        {joining ? (
                          <ActivityIndicator color="#ffffff" size="small" />
                        ) : (
                          <AtSign color="#ffffff" size={17} strokeWidth={2.4} />
                        )}
                      </Pressable>
                    </View>

                    <ScrollView
                      contentContainerStyle={styles.conversationList}
                      showsVerticalScrollIndicator={false}
                    >
                      <ConversationCard
                        active={conversation.kind === "lobby"}
                        icon={<Hash color="#ffffff" size={19} strokeWidth={2.4} />}
                        meta="Shared room"
                        onPress={handleOpenLobby}
                        preview="Open conversation"
                        styles={styles}
                        title="Lobby"
                      />

                      {visibleUsers.map((user) => (
                        <ConversationCard
                          active={
                            conversation.kind === "direct" &&
                            conversation.participant.id === user.id
                          }
                          icon={
                            <Text style={styles.cardAvatarText}>
                              {user.displayName.slice(0, 1).toUpperCase()}
                            </Text>
                          }
                          key={user.id}
                          meta={displayHandle(user.handle)}
                          onPress={() => handleOpenDirectByUser(user)}
                          preview="Personal chat"
                          styles={styles}
                          title={user.displayName}
                        />
                      ))}

                      {visibleUsers.length === 0 ? (
                        <View style={styles.noContacts}>
                          <Text style={styles.noContactsTitle}>No contacts yet</Text>
                          <Text style={styles.noContactsText}>
                            New users will appear here after they register.
                          </Text>
                        </View>
                      ) : null}
                    </ScrollView>
                  </>
                ) : (
                  <SectionPanel
                    activeSection={activeSection}
                    connection={connection}
                    handleOpenDirectByUser={handleOpenDirectByUser}
                    handleOpenLobby={handleOpenLobby}
                    handleProfileDraftChange={handleProfileDraftChange}
                    handleSaveProfile={handleSaveProfile}
                    onToggleTheme={onToggleTheme}
                    profileDraft={profileDraft}
                    savingProfile={savingProfile}
                    session={session}
                    settingsNotice={settingsNotice}
                    statusLabel={statusLabel}
                    styles={styles}
                    theme={theme}
                    users={visibleUsers}
                  />
                )}
              </>
            )}
          </View>

          <View style={styles.chatPanel}>
            <View style={styles.chatHeader}>
              <View style={styles.chatIdentity}>
                <View style={styles.chatAvatar}>
                  <Text style={styles.chatAvatarText}>
                    {conversation.title.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.chatTitleBlock}>
                  <Text numberOfLines={1} style={styles.chatTitle}>
                    {conversation.title}
                  </Text>
                  <Text numberOfLines={1} style={styles.chatSubtitle}>
                    {conversation.kind === "direct"
                      ? conversation.subtitle
                      : statusLabel}
                  </Text>
                </View>
              </View>
              <View style={styles.chatActions}>
                <View
                  style={[
                    styles.statusPill,
                    connection === "connected" ? styles.statusPillOn : null,
                  ]}
                >
                  {connection === "connected" ? (
                    <Wifi color="#16a34a" size={14} />
                  ) : (
                    <WifiOff color="#dc2626" size={14} />
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
                <IconButton
                  busy={pickingAttachment === "document"}
                  icon={<Paperclip color={styles.actionIcon.color} size={19} />}
                  label="Attach file"
                  onPress={() => void pickAttachment("document")}
                  styles={styles}
                />
                <IconButton
                  icon={<MoreVertical color={styles.actionIcon.color} size={20} />}
                  label="Settings"
                  onPress={() => {
                    setActiveSection("settings");
                    setInboxCollapsed(false);
                  }}
                  styles={styles}
                />
              </View>
            </View>

            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator color="#2f80ed" />
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
                    theme={theme}
                  />
                )}
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <Users color={styles.emptyIcon.color} size={30} />
                    <Text style={styles.emptyTitle}>{emptyTitle}</Text>
                    <Text style={styles.emptyText}>{emptyText}</Text>
                  </View>
                }
              />
            )}

            {error ? (
              <View style={styles.errorWrap}>
                <Text style={styles.error}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.composerWrap}>
              {selectedAttachment ? (
                <View style={styles.attachmentPreview}>
                  <View style={styles.attachmentPreviewIcon}>
                    {renderComposerAttachmentIcon(
                      selectedAttachment.kind,
                      styles.attachmentPreviewIconColor.color,
                    )}
                  </View>
                  <View style={styles.attachmentPreviewText}>
                    <Text numberOfLines={1} style={styles.attachmentName}>
                      {selectedAttachment.fileName}
                    </Text>
                    <Text style={styles.attachmentMeta}>
                      {formatFileSize(selectedAttachment.size)}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setSelectedAttachment(null)}
                    style={({ pressed }) => [
                      styles.clearAttachment,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <X color={styles.mutedIcon.color} size={17} />
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.composer}>
                <View style={styles.attachmentRail}>
                  <AttachmentButton
                    busy={pickingAttachment === "image"}
                    icon={<ImageIcon color="#ffffff" size={18} />}
                    onPress={() => void pickAttachment("image")}
                    styles={styles}
                  />
                  <AttachmentButton
                    busy={pickingAttachment === "video"}
                    icon={<Video color="#ffffff" size={18} />}
                    onPress={() => void pickAttachment("video")}
                    styles={styles}
                  />
                  <AttachmentButton
                    busy={pickingAttachment === "document"}
                    icon={<FileText color="#ffffff" size={18} />}
                    onPress={() => void pickAttachment("document")}
                    styles={styles}
                  />
                </View>
                <View style={styles.messageInputWrap}>
                  <Plus color={styles.mutedIcon.color} size={21} strokeWidth={2.4} />
                  <TextInput
                    multiline
                    onChangeText={setDraft}
                    placeholder={
                      conversation.kind === "direct"
                        ? `Message ${conversation.subtitle}`
                        : "Type a message here"
                    }
                    placeholderTextColor={styles.placeholder.color}
                    style={styles.messageInput}
                    value={draft}
                  />
                  <Smile color={styles.mutedIcon.color} size={20} />
                </View>
                <Pressable
                  accessibilityRole="button"
                  disabled={!canSend}
                  onPress={handleSend}
                  style={({ pressed }) => [
                    styles.sendButton,
                    pressed && canSend ? styles.pressed : null,
                    !canSend ? styles.disabled : null,
                  ]}
                >
                  {sending ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Send color="#ffffff" size={20} strokeWidth={2.5} />
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type NavItemProps = {
  active: boolean;
  compact: boolean;
  icon: ReactNode;
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
};

type SectionPanelProps = {
  activeSection: AppSection;
  connection: ConnectionState;
  handleOpenDirectByUser: (user: PublicUser) => void;
  handleOpenLobby: () => void;
  handleProfileDraftChange: (
    field: "displayName" | "username" | "handle" | "email",
    value: string,
  ) => void;
  handleSaveProfile: () => Promise<void>;
  onToggleTheme: () => void;
  profileDraft: {
    displayName: string;
    username: string;
    handle: string;
    email: string;
  };
  savingProfile: boolean;
  session: Session;
  settingsNotice: string | null;
  statusLabel: string;
  styles: ReturnType<typeof createStyles>;
  theme: AppTheme;
  users: PublicUser[];
};

function SectionPanel({
  activeSection,
  connection,
  handleOpenDirectByUser,
  handleOpenLobby,
  handleProfileDraftChange,
  handleSaveProfile,
  onToggleTheme,
  profileDraft,
  savingProfile,
  session,
  settingsNotice,
  statusLabel,
  styles,
  theme,
  users,
}: SectionPanelProps) {
  if (activeSection === "home") {
    return (
      <ScrollView
        contentContainerStyle={styles.sectionContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionCard}>
          <Text style={styles.sectionKicker}>Signed in as</Text>
          <Text style={styles.sectionTitle}>{session.user.displayName}</Text>
          <Text style={styles.sectionText}>{displayHandle(session.user.handle)}</Text>
        </View>
        <SectionAction
          icon={<Hash color="#ffffff" size={18} />}
          meta="Shared room"
          onPress={handleOpenLobby}
          styles={styles}
          title="Lobby is open in the main panel"
        />
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{users.length}</Text>
            <Text style={styles.statLabel}>Contacts</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{statusLabel}</Text>
            <Text style={styles.statLabel}>Connection</Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  if (activeSection === "contacts") {
    return (
      <ScrollView
        contentContainerStyle={styles.sectionContent}
        showsVerticalScrollIndicator={false}
      >
        {users.map((user) => (
          <SectionAction
            icon={
              <Text style={styles.cardAvatarText}>
                {user.displayName.slice(0, 1).toUpperCase()}
              </Text>
            }
            key={user.id}
            meta={displayHandle(user.handle)}
            onPress={() => handleOpenDirectByUser(user)}
            styles={styles}
            title={user.displayName}
          />
        ))}
        {users.length === 0 ? (
          <View style={styles.noContacts}>
            <Text style={styles.noContactsTitle}>No contacts yet</Text>
            <Text style={styles.noContactsText}>
              Create another account to see contacts here.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    );
  }

  if (activeSection === "notifications") {
    return (
      <ScrollView
        contentContainerStyle={styles.sectionContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionCard}>
          <View style={styles.noticeRow}>
            <Bell color={styles.actionIcon.color} size={20} />
            <View style={styles.noticeText}>
              <Text style={styles.sectionTitle}>Live message alerts</Text>
              <Text style={styles.sectionText}>
                New room messages appear instantly while the socket is connected.
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionKicker}>Socket status</Text>
          <Text style={styles.sectionTitle}>{statusLabel}</Text>
          <Text style={styles.sectionText}>
            {connection === "connected"
              ? "Messages and room joins are active."
              : "The client will keep trying to reconnect."}
          </Text>
        </View>
      </ScrollView>
    );
  }

  if (activeSection === "calendar") {
    const today = new Date();

    return (
      <ScrollView
        contentContainerStyle={styles.sectionContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionCard}>
          <Text style={styles.sectionKicker}>Today</Text>
          <Text style={styles.sectionTitle}>
            {today.toLocaleDateString(undefined, {
              day: "numeric",
              month: "long",
              weekday: "long",
            })}
          </Text>
          <Text style={styles.sectionText}>
            Calendar hooks are ready for scheduled chat reminders.
          </Text>
        </View>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>No events scheduled</Text>
          <Text style={styles.sectionText}>
            Keep this panel for future meetings, reminders, and message follow-ups.
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.sectionContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.settingsPanel}>
        <Text style={styles.settingsTitle}>Appearance</Text>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: theme === "dark" }}
          onPress={onToggleTheme}
          style={({ pressed }) => [
            styles.themeRow,
            pressed ? styles.pressed : null,
          ]}
        >
          <View style={styles.themeIcon}>
            {theme === "dark" ? (
              <Moon color="#bfdbfe" size={18} />
            ) : (
              <Sun color="#f59e0b" size={18} />
            )}
          </View>
          <View style={styles.themeTextBlock}>
            <Text style={styles.themeTitle}>Dark theme</Text>
            <Text style={styles.themeSubtitle}>
              {theme === "dark" ? "Enabled" : "Disabled"}
            </Text>
          </View>
          <View
            style={[
              styles.themeSwitch,
              theme === "dark" ? styles.themeSwitchOn : null,
            ]}
          >
            <View
              style={[
                styles.themeKnob,
                theme === "dark" ? styles.themeKnobOn : null,
              ]}
            />
          </View>
        </Pressable>
      </View>

      <View style={styles.settingsPanel}>
        <Text style={styles.settingsTitle}>Edit profile</Text>
        <SettingsField
          label="Display name"
          onChangeText={(value) => handleProfileDraftChange("displayName", value)}
          placeholder="Your name"
          styles={styles}
          value={profileDraft.displayName}
        />
        <SettingsField
          autoCapitalize="none"
          label="Username"
          onChangeText={(value) => handleProfileDraftChange("username", value)}
          placeholder="username"
          styles={styles}
          value={profileDraft.username}
        />
        <SettingsField
          autoCapitalize="none"
          label="Handle"
          onChangeText={(value) => handleProfileDraftChange("handle", value)}
          placeholder="@handle"
          styles={styles}
          value={profileDraft.handle}
        />
        <SettingsField
          autoCapitalize="none"
          keyboardType="email-address"
          label="Email"
          onChangeText={(value) => handleProfileDraftChange("email", value)}
          placeholder="you@example.com"
          styles={styles}
          value={profileDraft.email}
        />
        {settingsNotice ? (
          <Text style={styles.settingsNotice}>{settingsNotice}</Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={savingProfile}
          onPress={() => void handleSaveProfile()}
          style={({ pressed }) => [
            styles.saveButton,
            pressed && !savingProfile ? styles.pressed : null,
            savingProfile ? styles.disabled : null,
          ]}
        >
          {savingProfile ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Save color="#ffffff" size={18} strokeWidth={2.4} />
          )}
          <Text style={styles.saveButtonText}>Save changes</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

type SectionActionProps = {
  icon: ReactNode;
  meta: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  title: string;
};

function SectionAction({
  icon,
  meta,
  onPress,
  styles,
  title,
}: SectionActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.sectionAction,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.cardAvatar}>{icon}</View>
      <View style={styles.cardText}>
        <Text numberOfLines={1} style={styles.cardTitle}>
          {title}
        </Text>
        <Text numberOfLines={1} style={styles.cardMeta}>
          {meta}
        </Text>
      </View>
    </Pressable>
  );
}

type SettingsFieldProps = {
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address";
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  styles: ReturnType<typeof createStyles>;
  value: string;
};

function SettingsField({
  autoCapitalize,
  keyboardType,
  label,
  onChangeText,
  placeholder,
  styles,
  value,
}: SettingsFieldProps) {
  return (
    <View style={styles.settingsField}>
      <Text style={styles.settingsLabel}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={styles.placeholder.color}
        style={styles.settingsInput}
        value={value}
      />
    </View>
  );
}

function NavItem({
  active,
  compact,
  icon,
  label,
  onPress,
  styles,
}: NavItemProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.navItem,
        active ? styles.navItemActive : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={[styles.navIconWrap, active ? styles.navIconWrapActive : null]}>
        {icon}
      </View>
      {!compact ? <Text style={styles.navLabel}>{label}</Text> : null}
    </Pressable>
  );
}

type ConversationCardProps = {
  active: boolean;
  icon: ReactNode;
  meta: string;
  onPress: () => void;
  preview: string;
  styles: ReturnType<typeof createStyles>;
  title: string;
};

function ConversationCard({
  active,
  icon,
  meta,
  onPress,
  preview,
  styles,
  title,
}: ConversationCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.conversationCard,
        active ? styles.conversationCardActive : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={[styles.cardAvatar, active ? styles.cardAvatarActive : null]}>
        {icon}
      </View>
      <View style={styles.cardText}>
        <View style={styles.cardTopline}>
          <Text numberOfLines={1} style={styles.cardTitle}>
            {title}
          </Text>
          <Text style={styles.cardTime}>now</Text>
        </View>
        <Text numberOfLines={1} style={styles.cardMeta}>
          {meta}
        </Text>
        <Text numberOfLines={2} style={styles.cardPreview}>
          {preview}
        </Text>
      </View>
    </Pressable>
  );
}

type IconButtonProps = {
  busy?: boolean;
  icon: ReactNode;
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
};

function IconButton({ busy, icon, label, onPress, styles }: IconButtonProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        pressed && !busy ? styles.pressed : null,
        busy ? styles.disabled : null,
      ]}
    >
      {busy ? <ActivityIndicator color="#2f80ed" size="small" /> : icon}
    </Pressable>
  );
}

type AttachmentButtonProps = {
  busy: boolean;
  icon: ReactNode;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
};

function AttachmentButton({
  busy,
  icon,
  onPress,
  styles,
}: AttachmentButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.attachmentButton,
        pressed && !busy ? styles.pressed : null,
        busy ? styles.disabled : null,
      ]}
    >
      {busy ? <ActivityIndicator color="#ffffff" size="small" /> : icon}
    </Pressable>
  );
}

function renderComposerAttachmentIcon(kind: AttachmentKind, color: string) {
  const props = { color, size: 20, strokeWidth: 2.3 };

  if (kind === "image") {
    return <ImageIcon {...props} />;
  }

  if (kind === "video") {
    return <Video {...props} />;
  }

  return <FileText {...props} />;
}

async function readAssetAsDataUrl(
  asset: DocumentPicker.DocumentPickerAsset,
  mimeType: string,
) {
  const record = asset as DocumentPicker.DocumentPickerAsset & {
    file?: unknown;
  };
  let blob: unknown = record.file;

  if (!blob) {
    const response = await fetch(asset.uri);
    blob = await response.blob();
  }

  const dataUrl = await readBlobAsDataUrl(blob);
  const size =
    asset.size ??
    (typeof blob === "object" &&
    blob !== null &&
    "size" in blob &&
    typeof blob.size === "number"
      ? blob.size
      : estimateDataUrlSize(dataUrl));

  return {
    dataUrl: normalizeDataUrl(dataUrl, mimeType),
    size,
  };
}

function readBlobAsDataUrl(blob: unknown) {
  const Reader = (
    globalThis as unknown as { FileReader?: FileReaderConstructor }
  ).FileReader;

  if (!Reader) {
    throw new Error("File preview is not available on this platform.");
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new Reader();
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read file."));
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Unable to read file."));
    };
    reader.readAsDataURL(blob);
  });
}

function normalizeDataUrl(dataUrl: string, mimeType: string) {
  if (dataUrl.startsWith(`data:${mimeType};base64,`)) {
    return dataUrl;
  }

  const commaIndex = dataUrl.indexOf(",");

  if (dataUrl.startsWith("data:") && commaIndex > -1) {
    return `data:${mimeType};base64,${dataUrl.slice(commaIndex + 1)}`;
  }

  return dataUrl;
}

function estimateDataUrlSize(dataUrl: string) {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.max(1, Math.floor((base64.length * 3) / 4));
}

function inferMimeType(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "mp4":
      return "video/mp4";
    case "mov":
      return "video/quicktime";
    case "webm":
      return "video/webm";
    case "pdf":
      return "application/pdf";
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "ppt":
      return "application/vnd.ms-powerpoint";
    case "pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "txt":
      return "text/plain";
    default:
      return "application/octet-stream";
  }
}

function labelForAttachment(kind: AttachmentKind) {
  if (kind === "image") {
    return "Photo";
  }

  if (kind === "video") {
    return "Video";
  }

  return "Document";
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
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

function sectionTitle(section: AppSection) {
  switch (section) {
    case "home":
      return "Home";
    case "chat":
      return "Chats";
    case "contacts":
      return "Contacts";
    case "notifications":
      return "Notifications";
    case "calendar":
      return "Calendar";
    case "settings":
      return "Settings";
  }
}

function sectionSubtitle(section: AppSection) {
  switch (section) {
    case "home":
      return "Account overview";
    case "chat":
      return "Recent Chats";
    case "contacts":
      return "People by handle";
    case "notifications":
      return "Live app status";
    case "calendar":
      return "Schedule view";
    case "settings":
      return "Profile and preferences";
  }
}

function createStyles(
  theme: AppTheme,
  compact: boolean,
  navCollapsed: boolean,
  inboxCollapsed: boolean,
) {
  const dark = theme === "dark";
  const page = dark ? "#0f172a" : "#e9eefc";
  const rail = dark ? "#111827" : "#ffffff";
  const panel = dark ? "#172033" : "#f8fbff";
  const card = dark ? "#1f2937" : "#ffffff";
  const cardAlt = dark ? "#111827" : "#f1f5f9";
  const border = dark ? "#334155" : "#e2e8f0";
  const text = dark ? "#f8fafc" : "#111827";
  const muted = dark ? "#aab4c8" : "#64748b";
  const faint = dark ? "#6b7280" : "#94a3b8";
  const blue = "#2f80ed";

  return StyleSheet.create({
    safe: {
      backgroundColor: page,
      flex: 1,
    },
    keyboard: {
      flex: 1,
    },
    appShell: {
      backgroundColor: panel,
      borderRadius: 0,
      borderWidth: 0,
      flex: 1,
      flexDirection: compact ? "column" : "row",
      margin: 0,
      overflow: "hidden",
      boxShadow: "none",
    },
    navRail: {
      backgroundColor: rail,
      borderBottomColor: compact ? border : "transparent",
      borderBottomWidth: compact ? 1 : 0,
      borderRightColor: compact ? "transparent" : border,
      borderRightWidth: compact ? 0 : 1,
      flexDirection: compact ? "row" : "column",
      gap: compact ? 6 : navCollapsed ? 12 : 18,
      minHeight: compact ? 84 : undefined,
      paddingHorizontal: compact ? 10 : navCollapsed ? 12 : 22,
      paddingVertical: compact ? 10 : 28,
      width: compact ? "100%" : navCollapsed ? 82 : 250,
    },
    railCollapseButton: {
      alignItems: "center",
      alignSelf: navCollapsed ? "center" : "flex-end",
      backgroundColor: cardAlt,
      borderColor: border,
      borderRadius: 8,
      borderWidth: 1,
      height: 38,
      justifyContent: "center",
      width: 38,
    },
    profileBlock: {
      alignItems: "center",
      flexDirection: compact ? "row" : "column",
      gap: 8,
      minWidth: compact ? 58 : undefined,
    },
    profileAvatar: {
      alignItems: "center",
      backgroundColor: dark ? "#1e3a8a" : "#dbeafe",
      borderColor: dark ? "#60a5fa" : "#bfdbfe",
      borderRadius: 8,
      borderWidth: 1,
      height: compact || navCollapsed ? 42 : 72,
      justifyContent: "center",
      width: compact || navCollapsed ? 42 : 72,
    },
    profileAvatarText: {
      color: dark ? "#dbeafe" : "#1d4ed8",
      fontSize: compact || navCollapsed ? 18 : 30,
      fontWeight: "900",
    },
    profileName: {
      color: text,
      fontSize: 15,
      fontWeight: "800",
      marginTop: 4,
      maxWidth: 180,
    },
    profileHandle: {
      color: muted,
      fontSize: 12,
      marginTop: 2,
      maxWidth: 180,
    },
    navItems: {
      flex: 1,
      flexDirection: compact ? "row" : "column",
      gap: compact ? 5 : 6,
      justifyContent: compact ? "center" : "flex-start",
    },
    navItem: {
      alignItems: "center",
      borderRadius: 8,
      flexDirection: compact || navCollapsed ? "column" : "row",
      gap: 11,
      minHeight: compact ? 50 : 44,
      paddingHorizontal: compact ? 8 : 10,
    },
    navItemActive: {
      backgroundColor: dark ? "#172554" : "#eff6ff",
    },
    navIconWrap: {
      alignItems: "center",
      borderRadius: 7,
      height: 30,
      justifyContent: "center",
      width: 30,
    },
    navIconWrapActive: {
      backgroundColor: dark ? "#1d4ed8" : "#dbeafe",
    },
    navIcon: {
      color: dark ? "#cbd5e1" : "#475569",
    },
    navLabel: {
      color: dark ? "#cbd5e1" : "#475569",
      fontSize: 12,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    logoutButton: {
      alignItems: "center",
      borderRadius: 8,
      flexDirection: compact || navCollapsed ? "column" : "row",
      gap: 10,
      minHeight: compact ? 50 : 44,
      paddingHorizontal: 10,
    },
    logoutText: {
      color: dark ? "#cbd5e1" : "#475569",
      fontSize: 12,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    inboxPanel: {
      backgroundColor: panel,
      borderBottomColor: compact ? border : "transparent",
      borderBottomWidth: compact ? 1 : 0,
      borderRightColor: compact ? "transparent" : border,
      borderRightWidth: compact ? 0 : 1,
      maxHeight: compact ? 360 : undefined,
      padding: inboxCollapsed ? 10 : 22,
      width: compact ? "100%" : inboxCollapsed ? 72 : 410,
    },
    inboxCollapsedContent: {
      alignItems: "center",
      flex: 1,
      gap: 18,
      paddingTop: 8,
    },
    inboxHeader: {
      alignItems: compact ? "stretch" : "center",
      flexDirection: compact ? "column" : "row",
      gap: 14,
      justifyContent: "space-between",
      marginBottom: 18,
    },
    inboxHeaderActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10,
    },
    sidebarCollapseButton: {
      alignItems: "center",
      backgroundColor: card,
      borderColor: border,
      borderRadius: 8,
      borderWidth: 1,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    inboxTitle: {
      color: text,
      fontSize: 30,
      fontWeight: "900",
      letterSpacing: 0,
    },
    inboxSubtitle: {
      color: muted,
      fontSize: 13,
      fontWeight: "700",
      marginTop: 5,
    },
    newChatButton: {
      alignItems: "center",
      backgroundColor: blue,
      borderRadius: 7,
      flexDirection: "row",
      gap: 8,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: 14,
      boxShadow: "0 12px 18px rgba(47, 128, 237, 0.26)",
    },
    newChatText: {
      color: "#ffffff",
      fontSize: 13,
      fontWeight: "900",
    },
    searchRow: {
      alignItems: "center",
      backgroundColor: card,
      borderColor: border,
      borderRadius: 7,
      borderWidth: 1,
      flexDirection: "row",
      gap: 9,
      minHeight: 50,
      paddingLeft: 13,
      paddingRight: 7,
    },
    searchIcon: {
      color: muted,
    },
    placeholder: {
      color: faint,
    },
    handleInput: {
      color: text,
      flex: 1,
      fontSize: 14,
      minHeight: 46,
      paddingVertical: 8,
    },
    openButton: {
      alignItems: "center",
      backgroundColor: blue,
      borderRadius: 7,
      height: 36,
      justifyContent: "center",
      width: 40,
    },
    settingsPanel: {
      backgroundColor: card,
      borderColor: border,
      borderRadius: 8,
      borderWidth: 1,
      gap: 12,
      marginTop: 14,
      padding: 14,
    },
    sectionContent: {
      gap: 14,
      paddingBottom: 22,
      paddingTop: 2,
    },
    sectionCard: {
      backgroundColor: card,
      borderColor: border,
      borderRadius: 8,
      borderWidth: 1,
      padding: 16,
    },
    sectionKicker: {
      color: blue,
      fontSize: 12,
      fontWeight: "900",
      marginBottom: 7,
      textTransform: "uppercase",
    },
    sectionTitle: {
      color: text,
      fontSize: 17,
      fontWeight: "900",
      lineHeight: 22,
    },
    sectionText: {
      color: muted,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 6,
    },
    sectionAction: {
      alignItems: "center",
      backgroundColor: card,
      borderColor: border,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: "row",
      gap: 13,
      minHeight: 72,
      padding: 14,
    },
    statsGrid: {
      flexDirection: "row",
      gap: 12,
    },
    statCard: {
      backgroundColor: card,
      borderColor: border,
      borderRadius: 8,
      borderWidth: 1,
      flex: 1,
      minHeight: 78,
      padding: 14,
    },
    statValue: {
      color: text,
      fontSize: 18,
      fontWeight: "900",
    },
    statLabel: {
      color: muted,
      fontSize: 12,
      fontWeight: "800",
      marginTop: 5,
    },
    noticeRow: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: 12,
    },
    noticeText: {
      flex: 1,
      minWidth: 0,
    },
    settingsTitle: {
      color: text,
      fontSize: 16,
      fontWeight: "900",
    },
    settingsField: {
      gap: 7,
    },
    settingsLabel: {
      color: text,
      fontSize: 12,
      fontWeight: "900",
    },
    settingsInput: {
      backgroundColor: cardAlt,
      borderColor: border,
      borderRadius: 8,
      borderWidth: 1,
      color: text,
      fontSize: 14,
      minHeight: 44,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    settingsNotice: {
      color: dark ? "#bbf7d0" : "#166534",
      fontSize: 13,
      fontWeight: "800",
    },
    saveButton: {
      alignItems: "center",
      backgroundColor: blue,
      borderRadius: 8,
      flexDirection: "row",
      gap: 8,
      justifyContent: "center",
      minHeight: 46,
      paddingHorizontal: 14,
    },
    saveButtonText: {
      color: "#ffffff",
      fontSize: 14,
      fontWeight: "900",
    },
    themeRow: {
      alignItems: "center",
      backgroundColor: cardAlt,
      borderRadius: 8,
      flexDirection: "row",
      gap: 12,
      minHeight: 62,
      padding: 10,
    },
    themeIcon: {
      alignItems: "center",
      backgroundColor: dark ? "#172554" : "#fffbeb",
      borderRadius: 8,
      height: 38,
      justifyContent: "center",
      width: 38,
    },
    themeTextBlock: {
      flex: 1,
    },
    themeTitle: {
      color: text,
      fontSize: 14,
      fontWeight: "900",
    },
    themeSubtitle: {
      color: muted,
      fontSize: 12,
      marginTop: 2,
    },
    themeSwitch: {
      backgroundColor: dark ? "#334155" : "#cbd5e1",
      borderRadius: 999,
      height: 26,
      justifyContent: "center",
      paddingHorizontal: 3,
      width: 48,
    },
    themeSwitchOn: {
      backgroundColor: blue,
    },
    themeKnob: {
      backgroundColor: "#ffffff",
      borderRadius: 999,
      height: 20,
      width: 20,
    },
    themeKnobOn: {
      transform: [{ translateX: 22 }],
    },
    conversationList: {
      gap: 14,
      paddingTop: 16,
      paddingBottom: 22,
    },
    conversationCard: {
      backgroundColor: card,
      borderColor: border,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: "row",
      gap: 13,
      minHeight: 112,
      padding: 14,
      boxShadow: dark
        ? "0 10px 18px rgba(15, 23, 42, 0.2)"
        : "0 10px 18px rgba(15, 23, 42, 0.07)",
    },
    conversationCardActive: {
      borderColor: dark ? "#60a5fa" : "#bfdbfe",
      boxShadow: dark
        ? "0 10px 18px rgba(47, 128, 237, 0.25)"
        : "0 10px 18px rgba(47, 128, 237, 0.13)",
    },
    cardAvatar: {
      alignItems: "center",
      backgroundColor: dark ? "#334155" : "#94a3b8",
      borderRadius: 8,
      height: 48,
      justifyContent: "center",
      width: 48,
    },
    cardAvatarActive: {
      backgroundColor: blue,
    },
    cardAvatarText: {
      color: "#ffffff",
      fontSize: 18,
      fontWeight: "900",
    },
    cardText: {
      flex: 1,
      minWidth: 0,
    },
    cardTopline: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      justifyContent: "space-between",
    },
    cardTitle: {
      color: text,
      flex: 1,
      fontSize: 15,
      fontWeight: "900",
    },
    cardTime: {
      color: faint,
      fontSize: 11,
      fontWeight: "700",
    },
    cardMeta: {
      color: blue,
      fontSize: 12,
      fontWeight: "800",
      marginTop: 3,
    },
    cardPreview: {
      color: muted,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 12,
    },
    noContacts: {
      backgroundColor: card,
      borderColor: border,
      borderRadius: 8,
      borderWidth: 1,
      padding: 16,
    },
    noContactsTitle: {
      color: text,
      fontSize: 15,
      fontWeight: "900",
    },
    noContactsText: {
      color: muted,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 5,
    },
    chatPanel: {
      backgroundColor: dark ? "#0f172a" : "#ffffff",
      flex: 1,
      minHeight: 0,
    },
    chatHeader: {
      alignItems: "center",
      borderBottomColor: border,
      borderBottomWidth: 1,
      flexDirection: "row",
      gap: 14,
      justifyContent: "space-between",
      minHeight: 86,
      paddingHorizontal: compact ? 16 : 28,
      paddingVertical: 16,
    },
    chatIdentity: {
      alignItems: "center",
      flex: 1,
      flexDirection: "row",
      gap: 13,
      minWidth: 0,
    },
    chatAvatar: {
      alignItems: "center",
      backgroundColor: dark ? "#1e3a8a" : "#dbeafe",
      borderRadius: 8,
      height: 46,
      justifyContent: "center",
      width: 46,
    },
    chatAvatarText: {
      color: dark ? "#dbeafe" : "#1d4ed8",
      fontSize: 18,
      fontWeight: "900",
    },
    chatTitleBlock: {
      flex: 1,
      minWidth: 0,
    },
    chatTitle: {
      color: text,
      fontSize: 17,
      fontWeight: "900",
    },
    chatSubtitle: {
      color: blue,
      fontSize: 12,
      fontWeight: "800",
      marginTop: 3,
    },
    chatActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
    },
    statusPill: {
      alignItems: "center",
      backgroundColor: dark ? "#2f1f1f" : "#fef2f2",
      borderRadius: 999,
      flexDirection: "row",
      gap: 6,
      minHeight: 34,
      paddingHorizontal: 10,
    },
    statusPillOn: {
      backgroundColor: dark ? "#12341f" : "#dcfce7",
    },
    statusText: {
      color: dark ? "#fecaca" : "#b91c1c",
      fontSize: 12,
      fontWeight: "900",
    },
    statusTextOn: {
      color: dark ? "#bbf7d0" : "#166534",
    },
    iconButton: {
      alignItems: "center",
      backgroundColor: card,
      borderColor: border,
      borderRadius: 8,
      borderWidth: 1,
      height: 42,
      justifyContent: "center",
      width: 42,
    },
    actionIcon: {
      color: muted,
    },
    center: {
      alignItems: "center",
      flex: 1,
      justifyContent: "center",
    },
    messages: {
      paddingBottom: 18,
      paddingHorizontal: compact ? 16 : 30,
      paddingTop: 22,
    },
    emptyContainer: {
      flexGrow: 1,
      justifyContent: "center",
    },
    empty: {
      alignItems: "center",
      alignSelf: "center",
      maxWidth: 360,
    },
    emptyIcon: {
      color: muted,
    },
    emptyTitle: {
      color: text,
      fontSize: 18,
      fontWeight: "900",
      marginTop: 12,
    },
    emptyText: {
      color: muted,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 6,
      textAlign: "center",
    },
    errorWrap: {
      paddingHorizontal: compact ? 16 : 30,
      paddingTop: 8,
    },
    error: {
      color: dark ? "#fca5a5" : "#b91c1c",
      fontSize: 13,
      fontWeight: "700",
    },
    composerWrap: {
      borderTopColor: border,
      borderTopWidth: 1,
      paddingHorizontal: compact ? 12 : 28,
      paddingVertical: 14,
    },
    attachmentPreview: {
      alignItems: "center",
      backgroundColor: card,
      borderColor: border,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: "row",
      gap: 11,
      marginBottom: 10,
      padding: 10,
    },
    attachmentPreviewIcon: {
      alignItems: "center",
      backgroundColor: dark ? "#172554" : "#dbeafe",
      borderRadius: 8,
      height: 38,
      justifyContent: "center",
      width: 38,
    },
    attachmentPreviewIconColor: {
      color: dark ? "#bfdbfe" : blue,
    },
    attachmentPreviewText: {
      flex: 1,
      minWidth: 0,
    },
    attachmentName: {
      color: text,
      fontSize: 13,
      fontWeight: "900",
    },
    attachmentMeta: {
      color: muted,
      fontSize: 12,
      marginTop: 2,
    },
    clearAttachment: {
      alignItems: "center",
      borderRadius: 7,
      height: 32,
      justifyContent: "center",
      width: 32,
    },
    composer: {
      alignItems: "flex-end",
      flexDirection: "row",
      gap: 10,
    },
    attachmentRail: {
      gap: 8,
    },
    attachmentButton: {
      alignItems: "center",
      backgroundColor: blue,
      borderRadius: 999,
      height: 38,
      justifyContent: "center",
      width: 38,
    },
    messageInputWrap: {
      alignItems: "center",
      backgroundColor: card,
      borderColor: border,
      borderRadius: 8,
      borderWidth: 1,
      flex: 1,
      flexDirection: "row",
      gap: 10,
      minHeight: 52,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    messageInput: {
      color: text,
      flex: 1,
      fontSize: 15,
      lineHeight: 20,
      maxHeight: 120,
      minHeight: 38,
      paddingVertical: 8,
    },
    mutedIcon: {
      color: muted,
    },
    sendButton: {
      alignItems: "center",
      backgroundColor: blue,
      borderRadius: 999,
      height: 48,
      justifyContent: "center",
      width: 48,
    },
    pressed: {
      transform: [{ scale: 0.98 }],
    },
    disabled: {
      opacity: 0.45,
    },
  });
}
