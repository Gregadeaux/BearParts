"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PushToggle } from "@/components/notifications/push-toggle";
import { initials } from "@/components/parts/part-card";

interface Props {
  userName: string;
  userAvatar: string | null;
}

export function AppHeader({ userName, userAvatar }: Props) {
  const router = useRouter();

  const signOut = async () => {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="text-xl">🐻</span>
          <span>BearParts</span>
        </Link>
        <div className="flex-1" />
        <Button size="sm" nativeButton={false} render={<Link href="/parts/new" />}>
          + New part
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full outline-none ring-offset-2 focus-visible:ring-2">
            <Avatar className="size-8">
              {userAvatar && <AvatarImage src={userAvatar} alt={userName} referrerPolicy="no-referrer" />}
              <AvatarFallback className="text-xs">{initials(userName)}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate">{userName}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <PushToggle />
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut}>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
