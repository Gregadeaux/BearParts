import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Refresh the Supabase session and gate app routes behind login. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic =
    pathname === "/" || // anonymous visitors get the marketing landing page
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/inspect") ||
    pathname.startsWith("/api/dev-login") ||
    // Onshape panel iframe (no third-party cookies) + its Bearer-auth API
    pathname.startsWith("/onshape/panel") ||
    pathname.startsWith("/api/onshape") ||
    // link-preview images (id-only lookups, service role)
    pathname.startsWith("/api/og");

  // link-preview crawlers can't sign in — let them render the page shell,
  // which is empty for anonymous visitors but carries the OG metadata
  const isCrawler =
    /facebookexternalhit|Slackbot|Twitterbot|Discordbot|WhatsApp|LinkedInBot|TelegramBot|Googlebot|bingbot|Applebot|Iframely|redditbot|Embedly|SkypeUriPreview/i.test(
      request.headers.get("user-agent") ?? "",
    );
  if (!user && !isPublic && isCrawler && request.method === "GET") {
    return response;
  }

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (user && pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    const next = url.searchParams.get("next");
    url.pathname = next?.startsWith("/") && !next.startsWith("//") ? next : "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // everything except static assets, images, icons, and the service worker
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|wasm)$).*)",
  ],
};
