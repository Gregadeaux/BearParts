import { CircleAlert, CircleCheck, CircleX } from "lucide-react";
import type { VerificationResult } from "@/types/verification";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const META: Record<VerificationResult, { label: string; icon: typeof CircleCheck; className: string }> = {
  pass: {
    label: "Verified",
    icon: CircleCheck,
    className: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  },
  fail: {
    label: "Failed check",
    icon: CircleX,
    className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
  incomplete: {
    label: "Check incomplete",
    icon: CircleAlert,
    className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
};

interface Props {
  result: VerificationResult | null | undefined;
  /** icon only (board cards) — label moves to the tooltip */
  compact?: boolean;
  className?: string;
}

/** Latest measurement check on a part. Renders nothing for never-checked parts. */
export function VerificationBadge({ result, compact, className }: Props) {
  if (!result || !META[result]) return null;
  const { label, icon: Icon, className: tone } = META[result];
  if (compact) {
    return (
      <span title={label} aria-label={label} className={cn("inline-flex rounded-full p-0.5", tone, className)}>
        <Icon className="size-3.5" />
      </span>
    );
  }
  return (
    <Badge className={cn(tone, className)}>
      <Icon /> {label}
    </Badge>
  );
}
