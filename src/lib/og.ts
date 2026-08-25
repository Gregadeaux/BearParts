import type { Metadata } from "next";

/**
 * Open Graph metadata for link previews (Slack, Discord, iMessage…).
 * Crawlers reach pages anonymously (see proxy.ts), so generateMetadata
 * implementations use the admin client and only surface names/counts.
 */
export function ogMeta(title: string, description: string, image?: string | null): Metadata {
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: "BearParts",
      type: "website",
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}
