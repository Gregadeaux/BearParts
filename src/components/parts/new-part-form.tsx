"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ProfileRow, PartPriority } from "@/types/part";
import type { Units } from "@/types/analysis";
import type { AnalyzedDxf } from "@/services/dxf/analysis.service";
import { createClient } from "@/lib/supabase/client";
import { randomId } from "@/lib/id";
import { uploadDxf } from "@/services/storage.service";
import { createPartAction } from "@/app/actions/parts";
import { UploadDropzone } from "./upload-dropzone";
import { DxfWorkspace } from "@/components/viewer/dxf-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PART_PRIORITIES } from "@/types/part";

/** Upload → verify in viewer → submit. */
export function NewPartForm({ team }: { team: ProfileRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [file, setFile] = useState<File | null>(null);
  const [dxfText, setDxfText] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzedDxf | null>(null);
  const [unitOverride, setUnitOverride] = useState<Units | "auto">("auto");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [material, setMaterial] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [priority, setPriority] = useState<PartPriority>("normal");
  const [assignee, setAssignee] = useState<string>("queue");

  const pickFile = async (f: File) => {
    setFile(f);
    setDxfText(await f.text());
    if (!name) setName(f.name.replace(/\.dxf$/i, ""));
  };

  const submit = () =>
    startTransition(async () => {
      if (!file || !result) return;
      try {
        const supabase = createClient();
        const partId = randomId();
        const dxfPath = await uploadDxf(supabase, file, partId);
        const { id } = await createPartAction({
          name: name.trim() || file.name,
          description: description.trim() || undefined,
          material: material.trim() || undefined,
          quantity,
          priority,
          assignedTo: assignee === "queue" ? null : assignee,
          dxfPath,
          units: result.analysis.units,
          analysis: result.analysis,
        });
        toast.success("Part submitted");
        router.push(`/parts/${id}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Submit failed");
      }
    });

  if (!dxfText) return <UploadDropzone onFile={pickFile} />;

  return (
    <div className="space-y-4">
      <DxfWorkspace
        dxfText={dxfText}
        unitOverride={unitOverride === "auto" ? undefined : unitOverride}
        onAnalyzed={setResult}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Part name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Swerve mount plate" />
        </Field>
        <Field label="Material">
          <Input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder='1/4" 6061' />
        </Field>
        <Field label="Quantity">
          <Input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
          />
        </Field>
        <Field label="Priority">
          <Select
            value={priority}
            onValueChange={(v) => setPriority(v as PartPriority)}
            items={PART_PRIORITIES.map((p) => ({ value: p.value, label: p.label }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PART_PRIORITIES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Units">
          <Select
            value={unitOverride}
            onValueChange={(v) => setUnitOverride(v as Units | "auto")}
            items={[
              { value: "auto", label: "Auto-detect" },
              { value: "in", label: "Inches" },
              { value: "mm", label: "Millimeters" },
            ]}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto-detect</SelectItem>
              <SelectItem value="in">Inches</SelectItem>
              <SelectItem value="mm">Millimeters</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Machinist">
          <Select
            value={assignee}
            onValueChange={(v) => setAssignee(v ?? "queue")}
            items={[
              { value: "queue", label: "General queue" },
              ...team.map((m) => ({ value: m.id, label: m.display_name })),
            ]}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="queue">General queue</SelectItem>
              {team.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes for the machinist">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Deburr edges, countersink top holes…"
              rows={2}
            />
          </Field>
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="lg" disabled={pending || !result} onClick={submit}>
          {pending ? "Submitting…" : assignee === "queue" ? "Add to queue" : "Submit & assign"}
        </Button>
        <Button
          variant="ghost"
          size="lg"
          disabled={pending}
          onClick={() => {
            setFile(null);
            setDxfText(null);
            setResult(null);
          }}
        >
          Different file
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
