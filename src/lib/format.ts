/** 0.1590 → `0.159"`, 1.1250 → `1.125"` — up to 4 decimals, trailing zeros trimmed. */
export function formatInches(value: number): string {
  return `${parseFloat(value.toFixed(4))}"`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
