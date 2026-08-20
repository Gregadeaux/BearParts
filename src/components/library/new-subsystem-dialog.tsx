"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Blocks } from "lucide-react";
import type { ProjectRow } from "@/types/task";
import { createSubsystemAction } from "@/app/actions/subsystems";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  folderId: string;
  folderName: string;
  projects: ProjectRow[];
}

/** Promote the current library folder into a subsystem tied to a project. */
export function NewSubsystemDialog({ folderId, folderName, projects }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(folderName);
  const [projectId, setProjectId] = useState<string | null>(projects[0]?.id ?? null);
  const [pending, startTransition] = useTransition();

  const projectItems = projects.map((p) => ({ value: p.id, label: p.name }));

  const create = () =>
    startTransition(async () => {
      if (!name.trim() || !projectId) return;
      try {
        const subsystem = await createSubsystemAction({ name, projectId, folderId });
        toast.success(`"${subsystem.name}" created`);
        setOpen(false);
        router.push(`/subsystems/${subsystem.id}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not create subsystem");
      }
    });

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Blocks /> Make subsystem
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New subsystem</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Parts in <span className="font-medium text-foreground">{folderName}</span> (and its
            subfolders) become this subsystem&apos;s parts.
          </p>
          <Input
            autoFocus
            value={name}
            placeholder="Subsystem name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <Select
            value={projectId}
            items={projectItems}
            onValueChange={(v) => setProjectId(v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              {projectItems.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button disabled={pending || !name.trim() || !projectId} onClick={create}>
            {pending ? "Creating…" : "Create"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
