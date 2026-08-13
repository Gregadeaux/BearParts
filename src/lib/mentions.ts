/**
 * Comment mention grammar.
 *
 * User mentions are stored as stable tokens — `@[Dana Designer](user:<uuid>)` —
 * so display names with spaces (or later renames) can never break parsing.
 * Version mentions are plain `@v3`: unambiguous, and typeable without the picker.
 */

export type CommentSegment =
  | { kind: "text"; text: string }
  | { kind: "user"; userId: string; name: string }
  | { kind: "version"; version: number };

const TOKEN_RE = /@\[([^\]]+)\]\(user:([0-9a-f-]{36})\)|@v(\d{1,4})\b/g;

/** Split a stored comment body into renderable segments. */
export function parseComment(body: string): CommentSegment[] {
  const segments: CommentSegment[] = [];
  let last = 0;
  for (const match of body.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ kind: "text", text: body.slice(last, index) });
    if (match[2]) segments.push({ kind: "user", userId: match[2], name: match[1] });
    else segments.push({ kind: "version", version: parseInt(match[3], 10) });
    last = index + match[0].length;
  }
  if (last < body.length) segments.push({ kind: "text", text: body.slice(last) });
  return segments;
}

/** All user ids mentioned in a body (deduped) — drives notifications. */
export function mentionedUserIds(body: string): string[] {
  return [
    ...new Set(
      parseComment(body)
        .filter((s): s is Extract<CommentSegment, { kind: "user" }> => s.kind === "user")
        .map((s) => s.userId),
    ),
  ];
}

/** Serialize a user mention the composer inserts. */
export function userMentionToken(name: string, userId: string): string {
  return `@[${name.replaceAll("]", "")}](user:${userId})`;
}

/** Plain-text preview (tokens become @Name / @v2) for notification bodies. */
export function commentPreview(body: string, maxLength = 90): string {
  const flat = parseComment(body)
    .map((s) => (s.kind === "text" ? s.text : s.kind === "user" ? `@${s.name}` : `@v${s.version}`))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > maxLength ? `${flat.slice(0, maxLength - 1)}…` : flat;
}

/**
 * The active "@query" being typed at the caret, if any — drives the picker.
 * Returns the query text and where the token starts so it can be replaced.
 */
export function activeMentionQuery(
  text: string,
  caret: number,
): { query: string; start: number } | null {
  const upToCaret = text.slice(0, caret);
  const at = upToCaret.lastIndexOf("@");
  if (at === -1) return null;
  // @ must start a word (start of text or after whitespace)
  if (at > 0 && !/\s/.test(upToCaret[at - 1])) return null;
  const query = upToCaret.slice(at + 1);
  // stop once the fragment contains whitespace or bracket syntax (already a token)
  if (/[\s[\]()]/.test(query)) return null;
  return { query, start: at };
}
