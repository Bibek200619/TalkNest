import { Platform } from "react-native";

const defaultHost = Platform.select({
  android: "http://10.0.2.2:4000",
  default: "http://localhost:4000"
});

const env = typeof process !== "undefined" ? process.env : {};

export const API_URL = env.EXPO_PUBLIC_API_URL ?? defaultHost ?? "http://localhost:4000";
export const SOCKET_URL = API_URL;
export const ROOM_ID = "lobby";
