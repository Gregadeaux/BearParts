import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const mack = createClient(url, anon);
await mack.auth.signInWithPassword({ email: "machinist@test.bearparts.dev", password: "bearparts-test-2" });
const { data: { user: mackUser } } = await mack.auth.getUser();

const dana = createClient(url, anon);
await dana.auth.signInWithPassword({ email: "designer@test.bearparts.dev", password: "bearparts-test-1" });
const { data: { user: danaUser } } = await dana.auth.getUser();

// Mack notifies Dana (insert policy: any authenticated may notify anyone)
const { error: insErr } = await mack.from("notifications").insert({
  user_id: danaUser.id,
  actor_id: mackUser.id,
  kind: "mention",
  title: "Test notification",
  body: "Mack: sanity check",
  url: "/tasks",
});
console.log("insert as actor:", insErr ? `FAIL ${insErr.message}` : "ok");

// Dana sees it with the actor join
const { data: rows, error: selErr } = await dana
  .from("notifications")
  .select("id, title, read_at, actor:profiles!notifications_actor_id_fkey (display_name)")
  .eq("title", "Test notification");
console.log("select as recipient:", selErr ? `FAIL ${selErr.message}` : `ok (${rows.length} rows, actor=${rows[0]?.actor?.display_name})`);

// Mack cannot see Dana's notification
const { data: leak } = await mack.from("notifications").select("id").eq("title", "Test notification");
console.log("RLS hides from others:", leak.length === 0 ? "ok" : `FAIL (${leak.length} visible)`);

// Dana marks read + cleans up
const { error: updErr } = await dana.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", rows[0].id);
console.log("mark read:", updErr ? `FAIL ${updErr.message}` : "ok");
const { error: delErr } = await dana.from("notifications").delete().eq("id", rows[0].id);
console.log("cleanup:", delErr ? `FAIL ${delErr.message}` : "ok");
process.exit(0);
