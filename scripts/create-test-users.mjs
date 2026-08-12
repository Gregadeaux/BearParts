/* Creates local test users via the service-role API. Dev convenience only.
   Run: node scripts/create-test-users.mjs */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const users = [
  { email: "designer@test.bearparts.dev", password: "bearparts-test-1", name: "Dana Designer" },
  { email: "machinist@test.bearparts.dev", password: "bearparts-test-2", name: "Mack Machinist" },
];

for (const u of users) {
  const { data, error } = await admin.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
    user_metadata: { full_name: u.name },
  });
  if (error && !error.message.includes("already been registered")) {
    console.error(u.email, error.message);
  } else {
    console.log("ok:", u.email, data?.user?.id ?? "(exists)");
  }
}
