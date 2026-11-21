/* End-to-end check for part verification (migration 0028_verification.sql).
   Run AFTER the migration is applied. Pins designer = lead and machinist =
   student like test-roles.mjs, then checks: insert-own only, immutability (no
   update), lead-only delete, the parts.verification_result sync trigger, the
   thickness / model-size columns, and the new notification kind. The
   throwaway part "[verify test] ..." is removed with the service role.
   Note: RLS-denied updates/deletes return no error and 0 rows, so every
   "cannot" check re-reads with the service role.
   Run: node scripts/test-verifications.mjs */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, noSession);

let failures = 0;
function check(name, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${!ok && detail ? ` (${detail})` : ""}`);
  if (!ok) failures++;
}

async function signIn(email, password) {
  const client = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, noSession);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in ${email}: ${error.message} (run scripts/create-test-users.mjs)`);
  return { client, id: data.user.id };
}

const partState = async (id) =>
  (await admin.from("parts").select("verification_result, verified_at, thickness_in").eq("id", id).single()).data;
const verification = async (id) =>
  (await admin.from("part_verifications").select("id, result").eq("id", id).maybeSingle()).data;

const student = await signIn("machinist@test.bearparts.dev", "bearparts-test-2");
const lead = await signIn("designer@test.bearparts.dev", "bearparts-test-1");
for (const [who, role] of [[student, "student"], [lead, "lead"]]) {
  const { error } = await admin.from("profiles").update({ role }).eq("id", who.id);
  if (error) throw new Error(`pin role ${role}: ${error.message}`);
}

const dims = (measured, pass) => [
  { id: "length", kind: "length", label: "Overall length", nominal: 4, tolerance: 0.01, measured, deviation: measured - 4, pass },
];
let partId = null;

try {
  const part = await admin
    .from("parts")
    .insert({ name: `[verify test] ${randomUUID().slice(0, 8)}`, submitted_by: lead.id, file_path: `parts/${randomUUID()}.dxf` })
    .select("id")
    .single();
  if (part.error) throw new Error(`part setup: ${part.error.message}`);
  partId = part.data.id;

  // thickness + model size columns
  const thick = await student.client.from("parts").update({ thickness_in: 0.25 }).eq("id", partId);
  check("student can set thickness_in", !thick.error && Number((await partState(partId)).thickness_in) === 0.25, thick.error?.message);
  const badSize = await admin.from("parts").update({ model_size_in: [1, 2, 3] }).eq("id", partId);
  check("model_size_in rejects non-objects", Boolean(badSize.error), "array accepted");
  const pv = await admin.from("part_versions").select("thickness_in").limit(1);
  check("part_versions.thickness_in exists", !pv.error, pv.error?.message);

  // inserts: own only
  const forged = await student.client
    .from("part_verifications")
    .insert({ part_id: partId, verified_by: lead.id, result: "pass", dimensions: dims(4, true) });
  check("student cannot record a check as someone else", Boolean(forged.error), "insert succeeded");

  const failRow = await student.client
    .from("part_verifications")
    .insert({ part_id: partId, verified_by: student.id, result: "fail", dimensions: dims(4.5, false) })
    .select("id")
    .single();
  check("student can record a check", !failRow.error, failRow.error?.message);
  check("trigger: latest result = fail", (await partState(partId)).verification_result === "fail");

  await new Promise((r) => setTimeout(r, 50)); // distinct created_at
  const passRow = await student.client
    .from("part_verifications")
    .insert({ part_id: partId, verified_by: student.id, result: "pass", dimensions: dims(4.005, true) })
    .select("id")
    .single();
  check("trigger: newer pass wins", !passRow.error && (await partState(partId)).verification_result === "pass", passRow.error?.message);

  // immutability
  await student.client.from("part_verifications").update({ result: "pass" }).eq("id", failRow.data.id);
  check("student cannot edit a check", (await verification(failRow.data.id))?.result === "fail", "result changed");
  await lead.client.from("part_verifications").update({ result: "pass" }).eq("id", failRow.data.id);
  check("lead cannot edit a check either", (await verification(failRow.data.id))?.result === "fail", "result changed");

  // delete: lead only, and the badge falls back
  await student.client.from("part_verifications").delete().eq("id", passRow.data.id);
  check("student cannot delete a check", Boolean(await verification(passRow.data.id)), "row is gone");
  await lead.client.from("part_verifications").delete().eq("id", passRow.data.id);
  check("lead can delete a check", !(await verification(passRow.data.id)), "row still exists");
  check("trigger: falls back to previous (fail)", (await partState(partId)).verification_result === "fail");
  await lead.client.from("part_verifications").delete().eq("id", failRow.data.id);
  const cleared = await partState(partId);
  check("trigger: clears when none remain", cleared.verification_result === null && cleared.verified_at === null);

  // notification kind
  const note = await admin
    .from("notifications")
    .insert({ user_id: lead.id, kind: "part_check_failed", title: "t", body: "b", url: `/parts/${partId}` })
    .select("id")
    .single();
  check("notifications accept kind part_check_failed", !note.error, note.error?.message);
  if (note.data) await admin.from("notifications").delete().eq("id", note.data.id);

  // cascade: deleting the part with checks attached still works
  await admin.from("part_verifications").insert({ part_id: partId, verified_by: student.id, result: "pass", dimensions: dims(4, true) });
  const del = await admin.from("parts").delete().eq("id", partId);
  check("part delete cascades its checks (sync trigger tolerates it)", !del.error, del.error?.message);
  if (!del.error) partId = null;
} catch (e) {
  check("run", false, e instanceof Error ? e.message : String(e));
} finally {
  if (partId) await admin.from("parts").delete().eq("id", partId);
  await admin.from("profiles").update({ role: "student" }).eq("id", student.id);
  await admin.from("profiles").update({ role: "student" }).eq("id", lead.id);
}

console.log(failures ? `\n${failures} check(s) FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
