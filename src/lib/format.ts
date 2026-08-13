/** 0.1590 → `0.159"`, 1.1250 → `1.125"` — up to 4 decimals, trailing zeros trimmed. */
export function formatInches(value: number): string {
  return `${parseFloat(value.toFixed(4))}"`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** "Aug 13, 9:41 AM" */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "Dana Designer" → "DD" */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
