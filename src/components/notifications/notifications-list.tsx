"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AtSign, Bell, CheckCheck, ListTodo, RefreshCw, Wrench } from "lucide-react";
import type { AppNotification, NotificationKind } from "@/services/inbox.service";
import { listNotifications } from "@/services/inbox.service";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/actions/inbox";
import { createClient } from "@/lib/supabase/client";
import { useLiveTable } from "@/lib/use-live-table";
import { cn } from "@/lib/utils";
import { formatDateTime, initials } from "@/lib/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const KIND_ICONS: Record<NotificationKind, typeof Bell> = {
  part_assigned: Wrench,
  task_assigned: ListTodo,
  mention: AtSign,
  part_update: RefreshCw,
  task_update: RefreshCw,
};

interface Props {
  initial: AppNotification[];
}

/** The inbox: unread rows highlighted, click marks read and follows the link. */
export function NotificationsList({ initial }: Props) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initial);
  const unread = notifications.filter((n) => n.read_at === null).length;

  const refetch = useCallback(() => {
    listNotifications(createClient()).then(setNotifications).catch(console.error);
  }, []);

  useLiveTable({ table: "notifications", onChange: refetch });

  const open = (notification: AppNotification) => {
    if (notification.read_at === null) {
      setNotifications((ns) =>
        ns.map((n) => (n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n)),
      );
      markNotificationReadAction(notification.id).catch(() => {});
    }
    router.push(notification.url);
  };

  const markAll = () => {
    const now = new Date().toISOString();
    setNotifications((ns) => ns.map((n) => (n.read_at === null ? { ...n, read_at: now } : n)));
    markAllNotificationsReadAction().catch(() => {
      toast.error("Could not mark everything read");
      refetch();
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground">
          {unread > 0 ? `${unread} unread` : "All caught up."}
        </p>
        <div className="flex-1" />
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={markAll}>
            <CheckCheck /> Mark all read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border py-12 text-muted-foreground">
          <Bell className="size-6" />
          <p className="text-sm">Nothing yet — assignments, mentions, and updates land here.</p>
        </div>
      ) : (
        <div className="divide-y overflow-hidden rounded-lg border">
          {notifications.map((notification) => {
            const Icon = KIND_ICONS[notification.kind] ?? Bell;
            const isUnread = notification.read_at === null;
            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => open(notification)}
                className={cn(
                  "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
                  isUnread && "bg-accent/40",
                )}
              >
                <span className="relative mt-0.5 shrink-0">
                  <Avatar className="size-7">
                    {notification.actor?.avatar_url && (
                      <AvatarImage
                        src={notification.actor.avatar_url}
                        alt={notification.actor.display_name}
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <AvatarFallback className="text-[10px]">
                      {notification.actor ? initials(notification.actor.display_name) : <Icon className="size-3.5" />}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-background">
                    <Icon className="size-3 text-muted-foreground" />
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className={cn("min-w-0 truncate text-sm", isUnread && "font-semibold")}>
                      {notification.title}
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {formatDateTime(notification.created_at)}
                    </span>
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {notification.body}
                  </span>
                </span>
                {isUnread && (
                  <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
