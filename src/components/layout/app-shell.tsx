"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { AppSidebar } from "./app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

interface Props {
  userName: string;
  userAvatar: string | null;
  /** shown in the top bar next to the sidebar trigger */
  title?: string;
  children: React.ReactNode;
}

/** Dashboard shell (shadcn sidebar layout): nav sidebar + slim top bar + content. */
export function AppShell({ userName, userAvatar, title, children }: Props) {
  return (
    <SidebarProvider>
      <AppSidebar userName={userName} userAvatar={userAvatar} />
      <SidebarInset>
        <header className="sticky top-0 z-40 flex h-13 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-1 h-4" />
          {title && <h1 className="truncate text-sm font-semibold">{title}</h1>}
          <div className="flex-1" />
          <Button size="sm" nativeButton={false} render={<Link href="/parts/new" />}>
            <Plus /> New part
          </Button>
        </header>
        <div className="flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
