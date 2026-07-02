export function formatMessageTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();
  const sameDay =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate();

  if (sameDay) {
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
  }

  return date.toLocaleString([], {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  });
}
