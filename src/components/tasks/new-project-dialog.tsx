"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createProjectAction } from "@/app/actions/tasks";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (project: { id: string; name: string }) => void;
}

/** Name-only project creation ("2027 Season", "Chairman's Push", …). */
export function NewProjectDialog({ open, onOpenChange, onCreated }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  const create = () =>
    startTransition(async () => {
      if (!name.trim()) return;
      try {
        const project = await createProjectAction(name);
        toast.success(`"${project.name}" created`);
        setName("");
        onOpenChange(false);
        onCreated?.(project);
        router.push(`/tasks?project=${project.id}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not create project");
      }
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="e.g. 2027 Season"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
        />
        <Button disabled={pending || !name.trim()} onClick={create}>
          {pending ? "Creating…" : "Create"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
