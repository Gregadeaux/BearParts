"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { deleteSubsystemAction } from "@/app/actions/subsystems";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  subsystemId: string;
  subsystemName: string;
  folderId: string;
}

/** Delete the subsystem (folder, parts, and tasks all survive). */
export function SubsystemActions({ subsystemId, subsystemName, folderId }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const remove = () =>
    startTransition(async () => {
      try {
        await deleteSubsystemAction(subsystemId);
        toast.success(`Deleted "${subsystemName}"`);
        router.push(`/library?f=${folderId}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not delete subsystem");
      }
    });

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Delete subsystem"
        onClick={() => setConfirming(true)}
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 />
      </Button>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete subsystem?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{subsystemName}</span> will be removed.
              Its folder, parts, and tasks are all kept — tasks just lose the subsystem tag.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={pending} onClick={remove}>
              {pending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
