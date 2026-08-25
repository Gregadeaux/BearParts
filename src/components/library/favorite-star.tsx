"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { setFolderFavoriteAction } from "@/app/actions/folder-favorites";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  folderId: string;
  initialFavorite: boolean;
}

/** Star toggle: favorited folders appear on the user's home page. */
export function FavoriteStar({ folderId, initialFavorite }: Props) {
  const router = useRouter();
  // optimistic override, keyed to the folder so navigation resets it
  const [override, setOverride] = useState<{ id: string; value: boolean } | null>(null);
  const favorite = override?.id === folderId ? override.value : initialFavorite;

  const toggle = async () => {
    const next = !favorite;
    setOverride({ id: folderId, value: next });
    try {
      await setFolderFavoriteAction(folderId, next);
      toast.success(next ? "Added to your home page" : "Removed from favorites");
      router.refresh();
    } catch (e) {
      setOverride({ id: folderId, value: !next });
      toast.error(e instanceof Error ? e.message : "Could not update favorite");
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={favorite}
      onClick={toggle}
    >
      <Star className={cn(favorite && "fill-amber-400 text-amber-400")} />
      {favorite ? "Favorited" : "Favorite"}
    </Button>
  );
}
