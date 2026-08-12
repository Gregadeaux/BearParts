import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Register (POST) or remove (DELETE) a web-push subscription for the signed-in user. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sub = (await request.json()) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys.auth) {
    return NextResponse.json({ error: "invalid subscription" }, { status: 400 });
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    { onConflict: "endpoint" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { endpoint } = (await request.json()) as { endpoint?: string };
  if (!endpoint) return NextResponse.json({ error: "endpoint required" }, { status: 400 });

  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return NextResponse.json({ ok: true });
}
