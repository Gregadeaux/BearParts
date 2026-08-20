// Creates a throwaway subsystem, prints its id, and leaves cleanup to the caller.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
await supabase.auth.signInWithPassword({ email: "designer@test.bearparts.dev", password: "bearparts-test-1" });
const { data: { user } } = await supabase.auth.getUser();

const action = process.argv[2];
if (action === "cleanup") {
  const { error } = await supabase.from("subsystems").delete().eq("name", "Smoke Test Subsystem");
  console.log(error ? `cleanup FAIL: ${error.message}` : "cleanup ok");
  process.exit(0);
}

const { data: folder } = await supabase.from("folders").select("id, name").limit(1).single();
const { data: project } = await supabase.from("projects").select("id, name").limit(1).single();
if (!folder || !project) {
  console.log("SKIP: need at least one folder and one project");
  process.exit(1);
}

const { data: sub, error } = await supabase
  .from("subsystems")
  .insert({ name: "Smoke Test Subsystem", project_id: project.id, folder_id: folder.id, created_by: user.id })
  .select()
  .single();
if (error) {
  console.log(`insert FAIL: ${error.message}`);
  process.exit(1);
}
console.log(`created ${sub.id} on folder "${folder.name}" project "${project.name}"`);

// comment + BOM item round-trip
const { error: cErr } = await supabase
  .from("subsystem_comments")
  .insert({ subsystem_id: sub.id, author_id: user.id, body: "smoke test comment" });
console.log(cErr ? `comment FAIL: ${cErr.message}` : "comment ok");

const { error: bErr } = await supabase
  .from("bom_items")
  .insert({ subsystem_id: sub.id, vendor: "wcp", name: "1/2 Hex Bearing", sku: "WCP-0034", quantity: 4, unit_price: 3.99 });
console.log(bErr ? `bom FAIL: ${bErr.message}` : "bom ok");
process.exit(0);
