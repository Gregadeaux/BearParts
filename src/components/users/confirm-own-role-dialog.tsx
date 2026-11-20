"use client";

import { roleLabel, type Role } from "@/types/role";
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
import { withArticle } from "./user-utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** the role you're about to give yourself (kept while the dialog animates out) */
  role: Role | null;
  onConfirm: () => void;
}

/** Guard rail: an admin changing their own role locks themselves out of /users. */
export function ConfirmOwnRoleDialog({ open, onOpenChange, role, onConfirm }: Props) {
  const label = role ? roleLabel(role) : "";
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Change your own role?</AlertDialogTitle>
          <AlertDialogDescription>
            {`You’ll be ${withArticle(label)} and lose access to this page. Another admin would have to undo it.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Make me {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
