/* End-to-end RLS check for user roles (migration 0027_roles.sql). Run AFTER
   the migration is applied. The service role pins designer = lead and
   machinist = student, then each signs in and pokes at the rules. Throwaway
   rows are named "[roles test] ..." (they may flash on live boards for a few
   seconds) and are always removed with the service role at the end.
   Note: RLS-denied deletes return no error and 0 rows, so every "cannot
   delete" check re-reads the row with the service role.
   Run: node scripts/test-roles.mjs */
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

async function roleOf(id) {
  const { data } = await admin.from("profiles").select("role").eq("id", id).single();
  return data?.role;
}

async function rowExists(table, id) {
  const { data, error } = await admin.from(table).select("id").eq("id", id).maybeSingle();
  if (error) throw new Error(`re-read ${table}: ${error.message}`);
  return Boolean(data);
}

async function archivedAt(partId) {
  const { data } = await admin.from("parts").select("archived_at").eq("id", partId).single();
  return data?.archived_at ?? null;
}

// list, not download: downloads can be served from cache briefly after a delete
async function fileExists(path) {
  const i = path.lastIndexOf("/");
  const { data, error } = await admin.storage.from("dxf").list(path.slice(0, i), { search: path.slice(i + 1) });
  if (error) throw new Error(`list ${path}: ${error.message}`);
  return data.some((f) => f.name === path.slice(i + 1));
}

const student = await signIn("machinist@test.bearparts.dev", "bearparts-test-2");
const lead = await signIn("designer@test.bearparts.dev", "bearparts-test-1");

for (const [who, role] of [
  [student, "student"],
  [lead, "lead"],
]) {
  const { error } = await admin.from("profiles").update({ role }).eq("id", who.id);
  if (error) throw new Error(`pin role ${role}: ${error.message} (is 0027_roles applied?)`);
}

const label = `[roles test] ${randomUUID().slice(0, 8)}`;
const storagePath = `roles-test/${randomUUID()}.txt`;
let taskId = null;
let partId = null;

try {
  // ============ student ============
  const ins = await student.client
    .from("tasks")
    .insert({ title: label, created_by: student.id })
    .select("id")
    .single();
  taskId = ins.data?.id ?? null;
  check("student can insert a task", !ins.error && Boolean(taskId), ins.error?.message);
  if (!taskId) throw new Error("cannot continue without a task");

  const done = await student.client
    .from("tasks")
    .update({ status: "done" })
    .eq("id", taskId)
    .select("status");
  check(
    "student can mark the task done",
    !done.error && done.data?.[0]?.status === "done",
    done.error?.message ?? `${done.data?.length ?? 0} rows updated`,
  );

  await student.client.from("tasks").delete().eq("id", taskId);
  check("student cannot delete the task", await rowExists("tasks", taskId), "row is gone");

  const escalate = await student.client.from("profiles").update({ role: "admin" }).eq("id", student.id);
  const studentRole = await roleOf(student.id);
  check("student cannot make self admin", studentRole === "student", `role is ${studentRole}`);
  check(
    "student self-promotion is rejected with an error",
    Boolean(escalate.error),
    "no error returned",
  );

  // comments: own = deletable, someone else's = not (until a lead steps in)
  const own = await student.client
    .from("task_comments")
    .insert({ task_id: taskId, author_id: student.id, body: "roles test: own" })
    .select("id")
    .single();
  const leads = await lead.client
    .from("task_comments")
    .insert({ task_id: taskId, author_id: lead.id, body: "roles test: lead's" })
    .select("id")
    .single();
  const forLead = await student.client
    .from("task_comments")
    .insert({ task_id: taskId, author_id: student.id, body: "roles test: for lead" })
    .select("id")
    .single();
  const commentSetup = [own, leads, forLead].find((r) => r.error);
  check("comment setup", !commentSetup, commentSetup?.error?.message);
  if (!commentSetup) {
    await student.client.from("task_comments").delete().eq("id", own.data.id);
    check("student can delete own comment", !(await rowExists("task_comments", own.data.id)), "row still exists");
    await student.client.from("task_comments").delete().eq("id", leads.data.id);
    check("student cannot delete others' comment", await rowExists("task_comments", leads.data.id), "row is gone");
  }

  // throwaway part, created by the service role, "submitted" by the student
  const part = await admin
    .from("parts")
    .insert({ name: label, submitted_by: student.id, file_path: `parts/${randomUUID()}.dxf` })
    .select("id")
    .single();
  if (part.error) throw new Error(`part setup: ${part.error.message}`);
  partId = part.data.id;

  const arch = await student.client
    .from("parts")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", partId);
  check("student cannot archive a part", (await archivedAt(partId)) === null, "archived_at was set");
  check("student archive is rejected with an error", Boolean(arch.error), "no error returned");

  await student.client.from("parts").delete().eq("id", partId);
  check("student cannot delete own part", await rowExists("parts", partId), "row is gone");

  // storage
  const up = await admin.storage
    .from("dxf")
    .upload(storagePath, new Blob(["roles test"], { type: "text/plain" }), { contentType: "text/plain" });
  check("storage setup", !up.error, up.error?.message);
  if (!up.error) {
    await student.client.storage.from("dxf").remove([storagePath]);
    check("student cannot delete a storage file", await fileExists(storagePath), "file is gone");
  }

  // ============ lead ============
  const leadArch = await lead.client
    .from("parts")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", partId);
  check("lead can archive a part", !leadArch.error && (await archivedAt(partId)) !== null, leadArch.error?.message);

  await student.client.from("parts").update({ archived_at: null }).eq("id", partId);
  check("student cannot restore an archived part", (await archivedAt(partId)) !== null, "archived_at was cleared");

  if (!up.error) {
    await lead.client.storage.from("dxf").remove([storagePath]);
    check("lead can delete a storage file", !(await fileExists(storagePath)), "file still exists");
  }

  if (!commentSetup) {
    await lead.client.from("task_comments").delete().eq("id", forLead.data.id);
    check("lead can delete anyone's comment", !(await rowExists("task_comments", forLead.data.id)), "row still exists");
  }

  await lead.client.from("profiles").update({ role: "lead" }).eq("id", student.id);
  const s = await roleOf(student.id);
  check("lead cannot change someone else's role", s === "student", `student's role is ${s}`);

  await lead.client.from("profiles").update({ role: "admin" }).eq("id", lead.id);
  const l = await roleOf(lead.id);
  check("lead cannot make self admin", l === "lead", `lead's role is ${l}`);

  await lead.client.from("parts").delete().eq("id", partId);
  check("lead can delete a part", !(await rowExists("parts", partId)), "row still exists");

  await lead.client.from("tasks").delete().eq("id", taskId);
  check("lead can delete the task", !(await rowExists("tasks", taskId)), "row still exists");
} catch (e) {
  check("run", false, e instanceof Error ? e.message : String(e));
} finally {
  // service-role cleanup (comments cascade with the task)
  if (taskId) await admin.from("tasks").delete().eq("id", taskId);
  if (partId) await admin.from("parts").delete().eq("id", partId);
  await admin.storage.from("dxf").remove([storagePath]);
  // undo any escalation that slipped through, so a failed run leaves no admins behind
  await admin.from("profiles").update({ role: "student" }).eq("id", student.id);
  // rest state: no known-password test account keeps delete rights
  await admin.from("profiles").update({ role: "student" }).eq("id", lead.id);
}

console.log(failures ? `\n${failures} check(s) FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
