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
  /**
   * Current page name appended after the folders (part detail). When set,
   * every folder in the ancestry is a link.
   */
  leaf?: string;
  /** folder id → subsystem id: those folder crumbs link to the subsystem page */
  subsystemsByFolder?: Record<string, string>;
}

/** Library › 2026 › Cyclone › Intake */
export function LibraryBreadcrumb({
  ancestry,
  basePath = "/library",
  root = { label: "Library", href: "/library" },
  leaf,
  subsystemsByFolder = {},
}: Props) {
  const folderHref = (folder: FolderRow) =>
    subsystemsByFolder[folder.id]
      ? `/subsystems/${subsystemsByFolder[folder.id]}`
      : `${basePath}?f=${folder.id}`;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {root && (
          <BreadcrumbItem>
            {ancestry.length === 0 && !leaf ? (
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
              {!leaf && i === ancestry.length - 1 ? (
                <BreadcrumbPage>{folder.name}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink render={<Link href={folderHref(folder)} />}>
                  {folder.name}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
        {leaf && (
          <>
            {(root || ancestry.length > 0) && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              <BreadcrumbPage>{leaf}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
