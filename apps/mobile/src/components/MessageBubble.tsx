import { StyleSheet, Text, View } from "react-native";
import type { ChatMessage } from "../types";
import { formatMessageTime } from "../utils/time";

type Props = {
  message: ChatMessage;
  own: boolean;
};

export function MessageBubble({ message, own }: Props) {
  return (
    <View style={[styles.row, own ? styles.ownRow : styles.receivedRow]}>
      <View style={[styles.bubble, own ? styles.ownBubble : styles.receivedBubble]}>
        {!own && <Text style={styles.sender}>{message.senderName}</Text>}
        <Text style={[styles.text, own ? styles.ownText : styles.receivedText]}>
          {message.text}
        </Text>
        <Text style={[styles.time, own ? styles.ownTime : styles.receivedTime]}>
          {formatMessageTime(message.timestamp)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    marginVertical: 5,
    width: "100%"
  },
  ownRow: {
    justifyContent: "flex-end"
  },
  receivedRow: {
    justifyContent: "flex-start"
  },
  bubble: {
    borderRadius: 18,
    maxWidth: "82%",
    minWidth: 76,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  ownBubble: {
    backgroundColor: "#143f37",
    borderBottomRightRadius: 6
  },
  receivedBubble: {
    backgroundColor: "#ffffff",
    borderBottomLeftRadius: 6,
    borderColor: "#dfe9e4",
    borderWidth: 1
  },
  sender: {
    color: "#4b88a2",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 3
  },
  text: {
    fontSize: 16,
    lineHeight: 22
  },
  ownText: {
    color: "#f8faf7"
  },
  receivedText: {
    color: "#14231f"
  },
  time: {
    alignSelf: "flex-end",
    fontSize: 11,
    marginTop: 5
  },
  ownTime: {
    color: "#cce0d9"
  },
  receivedTime: {
    color: "#667873"
  }
});
