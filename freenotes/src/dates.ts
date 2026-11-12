const TIME: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Hong_Kong",
};

function startOfDayHkt(ts: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ts));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return Date.parse(`${get("year")}-${get("month")}-${get("day")}T00:00:00+08:00`);
}

export function formatUpdated(ts: number, now = Date.now()): string {
  const day = startOfDayHkt(ts);
  const today = startOfDayHkt(now);
  const time = new Intl.DateTimeFormat("zh-Hant-HK", TIME).format(new Date(ts));
  const diffDays = Math.round((today - day) / 86_400_000);
  if (diffDays === 0) return `今天 ${time}`;
  if (diffDays === 1) return `昨天 ${time}`;
  if (diffDays < 7) {
    const weekday = new Intl.DateTimeFormat("zh-Hant-HK", {
      weekday: "short",
      timeZone: "Asia/Hong_Kong",
    }).format(new Date(ts));
    return `${weekday} ${time}`;
  }
  return new Intl.DateTimeFormat("zh-Hant-HK", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Hong_Kong",
  }).format(new Date(ts));
}
