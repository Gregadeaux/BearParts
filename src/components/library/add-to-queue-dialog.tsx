"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Hammer } from "lucide-react";
import type { ProfileRow, PartPriority } from "@/types/part";
import type { PartVersion } from "@/types/library";
import { queueFromVersionAction } from "@/app/actions/library";
import { PART_PRIORITIES } from "@/types/part";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  partName: string;
  version: PartVersion;
  team: ProfileRow[];
}

/** Send the selected version to the fab queue. */
export function AddToQueueDialog({ partName, version, team }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [quantity, setQuantity] = useState(1);
  const [priority, setPriority] = useState<PartPriority>("normal");
  const [material, setMaterial] = useState("");
  const [notes, setNotes] = useState("");
  const [assignee, setAssignee] = useState("queue");

  const submit = () =>
    startTransition(async () => {
      try {
        const { id } = await queueFromVersionAction(version.id, {
          name: `${partName} v${version.version}`,
          quantity,
          priority,
          material: material.trim() || undefined,
          description: notes.trim() || undefined,
          assignedTo: assignee === "queue" ? null : assignee,
        });
        toast.success("Sent to fab queue");
        setOpen(false);
        router.push(`/parts/${id}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not queue part");
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" nativeButton />}>
        <Hammer /> Add to fab queue
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Queue {partName} <span className="text-muted-foreground">v{version.version}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Quantity</Label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Priority</Label>
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
          </div>
          <div className="space-y-1.5">
            <Label>Material</Label>
            <Input
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder={version.file_type === "stl" ? "PETG" : '1/4" 6061'}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{version.file_type === "stl" ? "Operator" : "Machinist"}</Label>
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
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <Button disabled={pending} onClick={submit}>
          {pending ? "Queuing…" : "Add to queue"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
