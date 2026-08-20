"use client";

import { AppSidebar } from "./app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

interface Props {
  userName: string;
  userAvatar: string | null;
  /** shown in the top bar next to the sidebar trigger */
  title?: string;
  /** page-specific action button(s) on the right of the top bar */
  action?: React.ReactNode;
  children: React.ReactNode;
}

/** Dashboard shell (shadcn sidebar layout): nav sidebar + slim top bar + content. */
export function AppShell({ userName, userAvatar, title, action, children }: Props) {
  return (
    <SidebarProvider>
      <AppSidebar userName={userName} userAvatar={userAvatar} />
      <SidebarInset>
        <header className="sticky top-0 z-40 flex h-13 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-1 h-4" />
          {title && <h1 className="min-w-0 truncate text-sm font-semibold">{title}</h1>}
          <div className="flex-1" />
          {action}
        </header>
        <div className="flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
