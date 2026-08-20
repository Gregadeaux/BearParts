"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff } from "lucide-react";
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
        if (ok) toast.success("Notifications on");
        else toast.error("Notifications blocked by the browser");
      }
    } catch {
      toast.error("Could not update notifications");
    }
  };

  return (
    <DropdownMenuItem onClick={toggle}>
      {enabled ? <Bell /> : <BellOff />}
      {enabled ? "Notifications on" : "Notifications off"}
    </DropdownMenuItem>
  );
}
