/**
 * End-to-end smoke test of the Onshape panel flow in ONSHAPE_MOCK mode.
 * Needs the dev server on :3000 and env from .env.local.
 *
 *   node scripts/test-onshape-smoke.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

const BASE = "http://localhost:3000";
const CTX = "did=mock-doc&wvm=w&wvmid=mock-ws&eid=mock-el";
let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

// -- sign in as the test designer --------------------------------------------
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
  email: "designer@test.bearparts.dev",
  password: "bearparts-test-1",
});
if (authError) throw new Error(`test login failed: ${authError.message}`);
const bearer = { Authorization: `Bearer ${auth.session.access_token}` };

// -- auth boundaries ----------------------------------------------------------
check("panel page is public", (await fetch(`${BASE}/onshape/panel`)).status === 200);
check("status 401 without bearer", (await fetch(`${BASE}/api/onshape/status`)).status === 401);

// -- mock Onshape reads -------------------------------------------------------
const status = await (await fetch(`${BASE}/api/onshape/status`, { headers: bearer })).json();
check("status mock+connected", status.mock === true && status.connected === true, JSON.stringify(status));

const context = await (await fetch(`${BASE}/api/onshape/context?${CTX}`, { headers: bearer })).json();
check("context has parts", context.parts?.length === 3, context.documentName);

const faces = await (await fetch(`${BASE}/api/onshape/faces?${CTX}&partId=JHD`, { headers: bearer })).json();
check("faces listed", faces.faces?.length === 3);

const previewRes = await fetch(`${BASE}/api/onshape/preview?${CTX}&partId=JHD`, { headers: bearer });
check(
  "preview is a png",
  previewRes.status === 200 && previewRes.headers.get("content-type") === "image/png",
);

const subsRes = await (await fetch(`${BASE}/api/onshape/subsystems`, { headers: bearer })).json();
check("subsystems endpoint", Array.isArray(subsRes.subsystems), `${subsRes.subsystems?.length} subsystems`);

// -- exports ------------------------------------------------------------------
const exportBody = (mode, extra) => ({
  method: "POST",
  headers: { ...bearer, "Content-Type": "application/json" },
  body: JSON.stringify({
    mode,
    context: { documentId: "mock-doc", wvm: "w", wvmId: "mock-ws", elementId: "mock-el" },
    partId: "JHD",
    ...extra,
  }),
});
const dxfExport = await (await fetch(`${BASE}/api/onshape/export`, exportBody("dxf", { faceId: "F1" }))).json();
check(
  "dxf export",
  typeof dxfExport.dxf === "string" && Math.abs(dxfExport.envelope.width - 9.163) < 0.01,
  `envelope ${dxfExport.envelope?.width}×${dxfExport.envelope?.height}`,
);

const stepRes = await fetch(`${BASE}/api/onshape/export`, exportBody("step"));
const stepBytes = Buffer.from(await stepRes.arrayBuffer());
check("step export", stepRes.status === 200 && stepBytes.toString("utf8", 0, 9) === "ISO-10303", `${stepBytes.length} bytes`);

// -- import (dxf, no subsystem → fallback folder, queued) ---------------------
const marker = `Onshape Smoke ${Date.now()}`;
const fd = new FormData();
fd.set("file", new File([dxfExport.dxf], "smoke.dxf", { type: "application/dxf" }));
fd.set("name", marker);
fd.set("note", "smoke test import");
fd.set("queue", "1");
fd.set("quantity", "2");
fd.set("material", "6061 · 0.25 in");
const importRes = await fetch(`${BASE}/api/onshape/import`, { method: "POST", headers: bearer, body: fd });
const imported = await importRes.json();
check("import created part", importRes.status === 200 && Boolean(imported.libraryPartId), JSON.stringify(imported));
check("import queued part", Boolean(imported.queuedPartId));

// -- verify rows through the user session ------------------------------------
const { data: libPart } = await supabase
  .from("library_parts")
  .select("id, name, folder_id, folders (name), part_versions (id, file_type, analysis, note)")
  .eq("id", imported.libraryPartId)
  .single();
check("library part in fallback folder", libPart?.folders?.name === "Onshape imports", libPart?.folders?.name);
const version = libPart?.part_versions?.[0];
check("version is analyzed dxf", version?.file_type === "dxf" && Boolean(version?.analysis));

const { data: queued } = await supabase
  .from("parts")
  .select("id, name, quantity, material, source_version_id")
  .eq("id", imported.queuedPartId)
  .single();
check(
  "queue entry linked to version",
  queued?.source_version_id === version?.id && queued?.quantity === 2,
  queued?.material,
);

// -- import a STEP into the fallback folder (no queue) ------------------------
const fd2 = new FormData();
fd2.set("file", new File([stepBytes], "smoke.step", { type: "application/step" }));
fd2.set("name", `${marker} STEP`);
const import2 = await (await fetch(`${BASE}/api/onshape/import`, { method: "POST", headers: bearer, body: fd2 })).json();
check("step import", Boolean(import2.libraryPartId));

// -- cleanup ------------------------------------------------------------------
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
if (imported.queuedPartId) await admin.from("parts").delete().eq("id", imported.queuedPartId);
const paths = [];
for (const id of [imported.libraryPartId, import2.libraryPartId].filter(Boolean)) {
  const { data: versions } = await admin
    .from("part_versions")
    .select("file_path, thumb_path")
    .eq("library_part_id", id);
  for (const v of versions ?? []) {
    if (v.file_path) paths.push(v.file_path);
    if (v.thumb_path) paths.push(v.thumb_path);
  }
  await admin.from("library_parts").delete().eq("id", id);
}
if (paths.length) await admin.storage.from("dxf").remove(paths);
console.log(`cleanup: removed ${paths.length} storage files`);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
