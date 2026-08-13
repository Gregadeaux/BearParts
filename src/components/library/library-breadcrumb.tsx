"use client";

import Link from "next/link";
import type { FolderRow } from "@/types/library";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

/** Library › 2026 › Cyclone › Intake */
export function LibraryBreadcrumb({ ancestry }: { ancestry: FolderRow[] }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {ancestry.length === 0 ? (
            <BreadcrumbPage>Library</BreadcrumbPage>
          ) : (
            <BreadcrumbLink render={<Link href="/library" />}>Library</BreadcrumbLink>
          )}
        </BreadcrumbItem>
        {ancestry.map((folder, i) => (
          <BreadcrumbItem key={folder.id}>
            <BreadcrumbSeparator />
            {i === ancestry.length - 1 ? (
              <BreadcrumbPage>{folder.name}</BreadcrumbPage>
            ) : (
              <BreadcrumbLink render={<Link href={`/library?f=${folder.id}`} />}>
                {folder.name}
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
