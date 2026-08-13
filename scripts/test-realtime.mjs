/* Verifies postgres_changes delivery end-to-end: subscribe as a signed-in user,
   mutate a part with the service role, expect an event. */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const user = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: auth, error: authError } = await user.auth.signInWithPassword({
  email: "machinist@test.bearparts.dev",
  password: "bearparts-test-2",
});
if (authError) throw authError;
await user.realtime.setAuth(auth.session.access_token);

let received = 0;
const channel = user
  .channel("rt-test")
  .on("postgres_changes", { event: "*", schema: "public", table: "parts" }, (payload) => {
    received++;
    console.log("event:", payload.eventType, payload.new?.id ?? payload.old?.id ?? "");
  })
  .subscribe((status) => console.log("channel status:", status));

await new Promise((r) => setTimeout(r, 3000));

const { data: part } = await admin.from("parts").select("id, priority").limit(1).single();
console.log("mutating part", part.id);
await admin.from("parts").update({ priority: part.priority === "low" ? "normal" : "low" }).eq("id", part.id);
await new Promise((r) => setTimeout(r, 4000));
await admin.from("parts").update({ priority: part.priority }).eq("id", part.id);
await new Promise((r) => setTimeout(r, 4000));

console.log(received >= 1 ? `PASS: ${received} events received` : "FAIL: no events received");
await user.removeChannel(channel);
process.exit(received >= 1 ? 0 : 1);
