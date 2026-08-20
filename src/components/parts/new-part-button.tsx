"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Top-bar action for parts-domain pages. */
export function NewPartButton() {
  return (
    <Button size="sm" nativeButton={false} render={<Link href="/parts/new" />}>
      <Plus /> New part
    </Button>
  );
}
