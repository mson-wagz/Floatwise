export const ksh = (n: number): string => `KSh ${Math.round(n).toLocaleString("en-KE")}`;

export const pct = (p: number): string => `${Math.round(p * 100)}%`;

export const formatDate = (isoString: string): string => {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-KE", {
      month: "short",
      day: "numeric",
      weekday: "short",
    });
  } catch {
    return isoString;
  }
};

export const formatTime = (isoString: string): string => {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString("en-KE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};
