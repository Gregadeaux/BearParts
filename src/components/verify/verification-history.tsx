import type { PartVerification } from "@/types/verification";
import { VerificationRow } from "./verification-row";

/** Every check on the part, newest first; tap one to see its measurements. */
export function VerificationHistory({ verifications }: { verifications: PartVerification[] }) {
  if (verifications.length === 0) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">Checks</h3>
      <div className="divide-y overflow-hidden rounded-lg border">
        {verifications.map((v) => (
          <VerificationRow key={v.id} verification={v} />
        ))}
      </div>
    </section>
  );
}
