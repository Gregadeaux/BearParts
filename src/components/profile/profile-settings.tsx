"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FlaskConical } from "lucide-react";
import { updateProfileAction } from "@/app/actions/profile";
import { initials } from "@/lib/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
  experimentalFeatures: boolean;
}

export function ProfileSettings({ displayName, avatarUrl, email, experimentalFeatures }: Props) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [experimental, setExperimental] = useState(experimentalFeatures);
  const [pending, startTransition] = useTransition();

  const saveName = () =>
    startTransition(async () => {
      try {
        await updateProfileAction({ displayName: name });
        toast.success("Name updated");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save");
      }
    });

  const toggleExperimental = (next: boolean) => {
    setExperimental(next);
    startTransition(async () => {
      try {
        await updateProfileAction({ experimentalFeatures: next });
        toast.success(next ? "Experimental features on" : "Experimental features off");
        router.refresh();
      } catch (e) {
        setExperimental(!next);
        toast.error(e instanceof Error ? e.message : "Could not save");
      }
    });
  };

  return (
    <div className="space-y-4">
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          {email && <CardDescription>{email}</CardDescription>}
        </CardHeader>
        <CardContent className="flex items-end gap-3">
          <Avatar className="size-10">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} referrerPolicy="no-referrer" />}
            <AvatarFallback>{initials(displayName)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-1.5">
            <Label>Display name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button disabled={pending || name.trim() === displayName || !name.trim()} onClick={saveName}>
            Save
          </Button>
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="size-4" /> Experimental features
          </CardTitle>
          <CardDescription>
            Early, unpolished tools that may change or disappear. Currently: the DXF →
            G-code generator on part viewers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={experimental}
              disabled={pending}
              onCheckedChange={(c) => toggleExperimental(c === true)}
            />
            <span>Enable experimental features</span>
          </label>
        </CardContent>
      </Card>
    </div>
  );
}
