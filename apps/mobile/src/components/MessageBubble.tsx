import { useMemo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { FileText, Image as ImageIcon, Video } from "lucide-react-native";
import type { AppTheme, AttachmentKind, ChatMessage } from "../types";
import { formatMessageTime } from "../utils/time";

type Props = {
  message: ChatMessage;
  own: boolean;
  theme: AppTheme;
};

export function MessageBubble({ message, own, theme }: Props) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const attachment = message.attachment;

  return (
    <View style={[styles.row, own ? styles.ownRow : styles.receivedRow]}>
      <View style={[styles.bubble, own ? styles.ownBubble : styles.receivedBubble]}>
        {!own ? <Text style={styles.sender}>{message.senderName}</Text> : null}

        {attachment ? (
          <View
            style={[
              styles.attachmentCard,
              own ? styles.ownAttachmentCard : styles.receivedAttachmentCard,
            ]}
          >
            {attachment.kind === "image" ? (
              <Image
                accessibilityLabel={attachment.fileName}
                resizeMode="cover"
                source={{ uri: attachment.dataUrl }}
                style={styles.imagePreview}
              />
            ) : (
              <View style={styles.fileRow}>
                <View
                  style={[
                    styles.fileIcon,
                    own ? styles.ownFileIcon : styles.receivedFileIcon,
                  ]}
                >
                  {renderAttachmentIcon(attachment.kind, own)}
                </View>
                <View style={styles.fileText}>
                  <Text
                    numberOfLines={1}
                    style={[styles.fileName, own ? styles.ownText : styles.receivedText]}
                  >
                    {attachment.fileName}
                  </Text>
                  <Text style={[styles.fileMeta, own ? styles.ownMeta : styles.receivedMeta]}>
                    {attachment.kind.toUpperCase()} · {formatFileSize(attachment.size)}
                  </Text>
                </View>
              </View>
            )}
          </View>
        ) : null}

        {message.text ? (
          <Text style={[styles.text, own ? styles.ownText : styles.receivedText]}>
            {message.text}
          </Text>
        ) : null}

        <Text style={[styles.time, own ? styles.ownTime : styles.receivedTime]}>
          {formatMessageTime(message.timestamp)}
        </Text>
      </View>
    </View>
  );
}

function renderAttachmentIcon(kind: AttachmentKind, own: boolean) {
  const color = own ? "#eff6ff" : "#2563eb";
  const props = { color, size: 22, strokeWidth: 2.2 };

  if (kind === "image") {
    return <ImageIcon {...props} />;
  }

  if (kind === "video") {
    return <Video {...props} />;
  }

  return <FileText {...props} />;
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function createStyles(theme: AppTheme) {
  const dark = theme === "dark";

  return StyleSheet.create({
    row: {
      flexDirection: "row",
      marginVertical: 7,
      width: "100%",
    },
    ownRow: {
      justifyContent: "flex-end",
    },
    receivedRow: {
      justifyContent: "flex-start",
    },
    bubble: {
      borderRadius: 8,
      maxWidth: "78%",
      minWidth: 82,
      paddingHorizontal: 14,
      paddingVertical: 10,
      boxShadow: dark
        ? "0 8px 16px rgba(15, 23, 42, 0.22)"
        : "0 8px 16px rgba(15, 23, 42, 0.08)",
    },
    ownBubble: {
      backgroundColor: "#2f80ed",
      borderBottomRightRadius: 3,
    },
    receivedBubble: {
      backgroundColor: dark ? "#1f2937" : "#ffffff",
      borderBottomLeftRadius: 3,
      borderColor: dark ? "#374151" : "#e5e7eb",
      borderWidth: 1,
    },
    sender: {
      color: dark ? "#93c5fd" : "#2563eb",
      fontSize: 12,
      fontWeight: "800",
      marginBottom: 4,
    },
    text: {
      fontSize: 15,
      lineHeight: 21,
    },
    ownText: {
      color: "#ffffff",
    },
    receivedText: {
      color: dark ? "#f8fafc" : "#111827",
    },
    attachmentCard: {
      borderRadius: 8,
      marginBottom: 8,
      overflow: "hidden",
    },
    ownAttachmentCard: {
      backgroundColor: "rgba(255,255,255,0.16)",
    },
    receivedAttachmentCard: {
      backgroundColor: dark ? "#111827" : "#f8fafc",
      borderColor: dark ? "#374151" : "#e5e7eb",
      borderWidth: 1,
    },
    imagePreview: {
      aspectRatio: 1.35,
      minWidth: 190,
      width: "100%",
    },
    fileRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10,
      minWidth: 220,
      padding: 10,
    },
    fileIcon: {
      alignItems: "center",
      borderRadius: 8,
      height: 42,
      justifyContent: "center",
      width: 42,
    },
    ownFileIcon: {
      backgroundColor: "rgba(255,255,255,0.18)",
    },
    receivedFileIcon: {
      backgroundColor: dark ? "#1e3a8a" : "#dbeafe",
    },
    fileText: {
      flex: 1,
      minWidth: 0,
    },
    fileName: {
      fontSize: 14,
      fontWeight: "800",
    },
    fileMeta: {
      fontSize: 11,
      fontWeight: "700",
      marginTop: 3,
    },
    ownMeta: {
      color: "#dbeafe",
    },
    receivedMeta: {
      color: dark ? "#9ca3af" : "#64748b",
    },
    time: {
      alignSelf: "flex-end",
      fontSize: 11,
      marginTop: 6,
    },
    ownTime: {
      color: "#dbeafe",
    },
    receivedTime: {
      color: dark ? "#9ca3af" : "#64748b",
    },
  });
}
