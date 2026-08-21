/**
 * Debug the live Onshape API path using an admin-minted session for the
 * connected user. Prints response bodies only — never tokens.
 *
 *   node scripts/debug-onshape-live.mjs <email> <base> <path...>
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

const [email, base, ...paths] = process.argv.slice(2);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
if (error) throw error;

const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: otp, error: otpError } = await anon.auth.verifyOtp({
  type: "magiclink",
  token_hash: link.properties.hashed_token,
});
if (otpError) throw otpError;
const bearer = { Authorization: `Bearer ${otp.session.access_token}` };
console.log("session minted for", email);

for (const p of paths) {
  const res = await fetch(`${base}${p}`, { headers: bearer });
  const text = await res.text();
  console.log(`\n=== ${p}\n${res.status} ${text.slice(0, 1200)}`);
}
