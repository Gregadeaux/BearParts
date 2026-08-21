"use client";

import { useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Boxes, Link2, Unlink } from "lucide-react";
import { disconnectOnshapeAction } from "@/app/actions/onshape";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  connected: boolean;
  configured: boolean;
  mock: boolean;
}

/** Connect/disconnect the user's Onshape account. */
export function OnshapeConnectionCard({ connected, configured, mock }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  // one-shot result toast after the OAuth redirect lands back here
  useEffect(() => {
    const result = params.get("onshape");
    if (!result) return;
    if (result === "connected") toast.success("Onshape connected");
    else if (result === "not-configured") toast.error("Onshape credentials are not set up yet");
    else toast.error("Onshape connection failed — try again");
    router.replace("/integrations");
  }, [params, router]);

  const disconnect = () =>
    startTransition(async () => {
      try {
        await disconnectOnshapeAction();
        toast.success("Onshape disconnected");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not disconnect");
      }
    });

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Boxes className="size-4" /> Onshape
          {mock && <Badge variant="secondary">mock mode</Badge>}
          {connected && !mock && <Badge>Connected</Badge>}
        </CardTitle>
        <CardDescription>
          Send parts straight from an Onshape Part Studio into the library — the
          BearParts panel in Onshape exports a DXF of a selected face or a STEP
          of a whole part.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-2">
        {!configured ? (
          <p className="text-sm text-muted-foreground">
            Set <code className="font-mono text-xs">ONSHAPE_CLIENT_ID</code> and{" "}
            <code className="font-mono text-xs">ONSHAPE_CLIENT_SECRET</code> to enable.
          </p>
        ) : connected ? (
          <Button variant="outline" size="sm" disabled={pending || mock} onClick={disconnect}>
            <Unlink /> Disconnect
          </Button>
        ) : (
          <Button
            size="sm"
            render={<a href="/api/onshape/auth?next=/integrations" />}
            nativeButton={false}
          >
            <Link2 /> Connect Onshape
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
