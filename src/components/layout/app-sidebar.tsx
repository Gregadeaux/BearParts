"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, CalendarDays, FolderOpen, House, ListTodo, LogOut, Palette, Plus, ShoppingCart, SquareKanban } from "lucide-react";
import type { ProjectRow } from "@/types/task";
import { createClient } from "@/lib/supabase/client";
import { listProjects } from "@/services/tasks.service";
import { initials } from "@/lib/format";
import { NewProjectDialog } from "@/components/tasks/new-project-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { PushToggle } from "@/components/notifications/push-toggle";
import { useUnreadCount } from "@/components/notifications/use-unread-count";

const NAV = [
  { href: "/", label: "Home", icon: House },
  { href: "/board", label: "Board", icon: SquareKanban },
  { href: "/library", label: "Library", icon: FolderOpen },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/subgroups", label: "Subgroups", icon: Palette },
  { href: "/orders", label: "Orders", icon: ShoppingCart },
  { href: "/notifications", label: "Notifications", icon: Bell },
];

interface Props {
  userName: string;
  userAvatar: string | null;
}

/** App navigation sidebar — icon-collapsible on desktop, sheet on mobile. */
export function AppSidebar({ userName, userAvatar }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeProjectId = pathname.startsWith("/tasks") ? searchParams.get("project") : null;
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const unread = useUnreadCount();

  useEffect(() => {
    listProjects(createClient()).then(setProjects).catch(() => {});
  }, []);

  const signOut = async () => {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : href === "/board"
        ? pathname.startsWith("/board") || pathname.startsWith("/parts")
        : pathname.startsWith(href);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/" />}
              className="font-semibold"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
                BP
              </span>
              <span className="truncate">BearParts</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={isActive(item.href) && !activeProjectId}
                    tooltip={item.label}
                    render={<Link href={item.href} />}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                  {item.href === "/notifications" && unread > 0 && (
                    <SidebarMenuBadge className="rounded-full bg-primary text-primary-foreground">
                      {unread > 99 ? "99+" : unread}
                    </SidebarMenuBadge>
                  )}
                  {item.href === "/tasks" && (
                    <SidebarMenuSub>
                      {projects.map((project) => (
                        <SidebarMenuSubItem key={project.id}>
                          <SidebarMenuSubButton
                            isActive={activeProjectId === project.id}
                            render={<Link href={`/tasks?project=${project.id}`} />}
                          >
                            <span className="truncate">{project.name}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          className="text-muted-foreground"
                          render={<button type="button" onClick={() => setNewProjectOpen(true)} />}
                        >
                          <Plus className="size-3.5" />
                          <span>New project</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<SidebarMenuButton size="lg" tooltip={userName} />}
              >
                <Avatar className="size-8">
                  {userAvatar && <AvatarImage src={userAvatar} alt={userName} referrerPolicy="no-referrer" />}
                  <AvatarFallback className="text-xs">{initials(userName)}</AvatarFallback>
                </Avatar>
                <span className="truncate text-sm">{userName}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuLabel className="truncate">{userName}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <PushToggle />
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <NewProjectDialog
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
        onCreated={(p) => setProjects((ps) => [...ps, p as ProjectRow].sort((a, b) => a.name.localeCompare(b.name)))}
      />
    </Sidebar>
  );
}
