"use client";

import { Fragment } from "react";
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

interface Props {
  ancestry: FolderRow[];
  /** folder links become `${basePath}?f=<id>` */
  basePath?: string;
  /** leading crumb; null hides it (embedded views) */
  root?: { label: string; href: string } | null;
}

/** Library › 2026 › Cyclone › Intake */
export function LibraryBreadcrumb({
  ancestry,
  basePath = "/library",
  root = { label: "Library", href: "/library" },
}: Props) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {root && (
          <BreadcrumbItem>
            {ancestry.length === 0 ? (
              <BreadcrumbPage>{root.label}</BreadcrumbPage>
            ) : (
              <BreadcrumbLink render={<Link href={root.href} />}>{root.label}</BreadcrumbLink>
            )}
          </BreadcrumbItem>
        )}
        {ancestry.map((folder, i) => (
          <Fragment key={folder.id}>
            {(root || i > 0) && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {i === ancestry.length - 1 ? (
                <BreadcrumbPage>{folder.name}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink render={<Link href={`${basePath}?f=${folder.id}`} />}>
                  {folder.name}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
