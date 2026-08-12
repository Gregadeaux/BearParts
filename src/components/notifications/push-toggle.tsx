"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { getPushSubscription, subscribeToPush, unsubscribeFromPush } from "@/lib/push";

/** Menu item that toggles push notifications for this device. */
export function PushToggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    getPushSubscription()
      .then((sub) => setEnabled(Boolean(sub)))
      .catch(() => setEnabled(false));
  }, []);

  if (enabled === null) return null;

  const toggle = async () => {
    try {
      if (enabled) {
        await unsubscribeFromPush();
        setEnabled(false);
        toast("Notifications off");
      } else {
        const ok = await subscribeToPush();
        setEnabled(ok);
        toast(ok ? "Notifications on 🔔" : "Notifications blocked by the browser");
      }
    } catch {
      toast.error("Could not update notifications");
    }
  };

  return (
    <DropdownMenuItem onClick={toggle}>
      {enabled ? "🔔 Notifications on" : "🔕 Notifications off"}
    </DropdownMenuItem>
  );
}
