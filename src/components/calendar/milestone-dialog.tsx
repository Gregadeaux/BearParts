"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { MilestoneRow } from "@/services/milestones.service";
import {
  createMilestoneAction,
  deleteMilestoneAction,
  updateMilestoneAction,
} from "@/app/actions/milestones";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { DateField } from "@/components/tasks/date-field";

export interface MilestoneDialogState {
  /** null creates a new milestone */
  milestone: MilestoneRow | null;
  /** prefilled date for new milestones (yyyy-MM-dd) */
  defaultDate: string;
}

interface Props {
  state: MilestoneDialogState | null;
  onClose: () => void;
  /** fires after create/update/delete so the view can refetch immediately */
  onSaved: () => void;
}

/** Create/edit a milestone: title + date (+ optional notes). */
export function MilestoneDialog({ state, onClose, onSaved }: Props) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const wasOpen = useRef(false);

  useEffect(() => {
    if (state && !wasOpen.current) {
      setTitle(state.milestone?.title ?? "");
      setDate(state.milestone?.date ?? state.defaultDate);
      setNotes(state.milestone?.description ?? "");
    }
    wasOpen.current = state !== null;
  }, [state]);

  const save = () =>
    startTransition(async () => {
      const trimmed = title.trim();
      if (!trimmed || !date) return;
      const input = { title: trimmed, date, description: notes };
      try {
        if (state?.milestone) await updateMilestoneAction(state.milestone.id, input);
        else await createMilestoneAction(input);
        onSaved();
        onClose();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save milestone");
      }
    });

  const remove = () =>
    startTransition(async () => {
      if (!state?.milestone) return;
      try {
        await deleteMilestoneAction(state.milestone.id);
        setConfirming(false);
        onSaved();
        onClose();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not delete milestone");
      }
    });

  return (
    <Dialog open={state !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{state?.milestone ? "Edit milestone" : "New milestone"}</DialogTitle>
        </DialogHeader>

        <Input
          autoFocus={!state?.milestone}
          placeholder="e.g. Kickoff, Week 1 demo, Competition"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
        <DateField value={date} onChange={setDate} placeholder="Milestone day" />
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="min-h-14 resize-none"
        />

        <div className="flex items-center gap-2">
          {state?.milestone && (
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() => setConfirming(true)}
            >
              <Trash2 /> Delete
            </Button>
          )}
          <Button
            size="sm"
            className="ml-auto"
            disabled={pending || !title.trim() || !date}
            onClick={save}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>

        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete milestone?</AlertDialogTitle>
              <AlertDialogDescription>
                <span className="font-medium text-foreground">{state?.milestone?.title}</span> will
                be removed from the calendar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={pending} onClick={remove}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
