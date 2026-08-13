"use client";

import { useRef, useState } from "react";
import { AtSign, History, SendHorizontal } from "lucide-react";
import { activeMentionQuery, serializeMentions } from "@/lib/mentions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Suggestion {
  key: string;
  label: string;
  kind: "user" | "version";
  insert: string;
  userId?: string;
}

interface Props {
  team: { id: string; display_name: string }[];
  versions: number[];
  /** resolves true when the comment posted — composer clears only then */
  onSubmit: (body: string) => Promise<boolean>;
  pending: boolean;
}

/** Comment box with @-mention autocomplete for teammates and versions. */
export function MentionComposer({ team, versions, onSubmit, pending }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");
  const [caret, setCaret] = useState(0);
  const [highlight, setHighlight] = useState(0);
  const [dismissed, setDismissed] = useState<string | null>(null);
  // names the user picked this draft — serialized to stable tokens on submit
  const [picked, setPicked] = useState<Record<string, string>>({});

  const active = activeMentionQuery(value, caret);
  const suggestions: Suggestion[] =
    active && dismissed !== active.query
      ? [
          ...versions
            .filter((v) => `v${v}`.startsWith(active.query.toLowerCase()))
            .map((v) => ({
              key: `v${v}`,
              label: `v${v}`,
              kind: "version" as const,
              insert: `@v${v} `,
            })),
          ...team
            .filter((m) => m.display_name.toLowerCase().includes(active.query.toLowerCase()))
            .map((m) => ({
              key: m.id,
              label: m.display_name,
              kind: "user" as const,
              insert: `@${m.display_name} `, // stays readable while typing
              userId: m.id,
            })),
        ].slice(0, 6)
      : [];

  const pick = (s: Suggestion) => {
    if (!active) return;
    const next = value.slice(0, active.start) + s.insert + value.slice(caret);
    const newCaret = active.start + s.insert.length;
    setValue(next);
    setCaret(newCaret);
    setHighlight(0);
    if (s.userId) setPicked((p) => ({ ...p, [s.label]: s.userId! }));
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(newCaret, newCaret);
    });
  };

  const submit = async () => {
    const body = serializeMentions(value.trim(), picked);
    if (!body || pending) return;
    const ok = await onSubmit(body);
    if (ok) {
      setValue("");
      setCaret(0);
      setPicked({});
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const delta = e.key === "ArrowDown" ? 1 : -1;
        setHighlight((h) => (h + delta + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pick(suggestions[highlight]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setDismissed(active?.query ?? null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const syncCaret = (el: HTMLTextAreaElement) => setCaret(el.selectionStart ?? 0);

  return (
    <div className="relative">
      {suggestions.length > 0 && (
        <div className="absolute bottom-full left-0 z-20 mb-1 w-64 overflow-hidden rounded-md border bg-popover p-1 shadow-md">
          {suggestions.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // keep textarea focus
                pick(s);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm ${
                i === highlight ? "bg-accent text-accent-foreground" : ""
              }`}
            >
              {s.kind === "version" ? (
                <History className="size-3.5 text-muted-foreground" />
              ) : (
                <AtSign className="size-3.5 text-muted-foreground" />
              )}
              <span className="truncate">{s.label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={value}
          rows={2}
          placeholder="Comment — @ to mention someone or a version"
          className="min-h-9 resize-none"
          onChange={(e) => {
            setValue(e.target.value);
            syncCaret(e.target);
            setDismissed(null);
            setHighlight(0);
          }}
          onKeyDown={onKeyDown}
          onClick={(e) => syncCaret(e.currentTarget)}
          onKeyUp={(e) => syncCaret(e.currentTarget)}
        />
        <Button size="icon" aria-label="Send" disabled={pending || !value.trim()} onClick={submit}>
          <SendHorizontal />
        </Button>
      </div>
    </div>
  );
}
