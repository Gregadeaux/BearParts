/**
 * Public Shopify storefront lookups — no API key needed.
 * `/products/<handle>.json` has full product data; `/search/suggest.json`
 * finds the handle when a SKU isn't also the product handle (WCP's are).
 */

export interface ShopifyLookupResult {
  name: string;
  sku: string | null;
  url: string;
  unitPrice: number | null;
  imageUrl: string | null;
}

interface ShopifyProduct {
  title: string;
  handle: string;
  variants: { sku: string | null; price: string }[];
  image?: { src?: string } | null;
  images?: { src?: string }[];
}

// a FRESH abort signal per request — a shared AbortSignal.timeout starts its
// timer at module load and would kill every fetch after the first 8 seconds
function fetchOpts(): RequestInit {
  return {
    headers: { accept: "application/json", "user-agent": "BearParts BOM lookup" },
    signal: AbortSignal.timeout(8000),
  };
}

async function fetchProduct(base: string, handle: string): Promise<ShopifyProduct | null> {
  const res = await fetch(`${base}/products/${encodeURIComponent(handle)}.json`, fetchOpts());
  if (!res.ok) return null;
  const json = (await res.json()) as { product?: ShopifyProduct };
  return json.product ?? null;
}

async function findHandle(base: string, query: string): Promise<string | null> {
  const res = await fetch(
    `${base}/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product`,
    fetchOpts(),
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    resources?: { results?: { products?: { handle?: string }[] } };
  };
  return json.resources?.results?.products?.[0]?.handle ?? null;
}

export interface CartCandidate {
  name: string;
  sku: string | null;
  url: string | null;
  quantity: number;
}

export interface CartBuildResult {
  /** Shopify cart permalink, or null when nothing could be added */
  url: string | null;
  added: string[];
  skipped: string[];
}

interface ShopifyProductJs {
  variants: { id: number; sku: string | null; available: boolean }[];
}

/**
 * Build a `/cart/<variantId>:<qty>,...` permalink from order-list items.
 * The `.js` endpoint carries live availability — out-of-stock items are skipped.
 */
export async function buildCartPermalink(
  base: string,
  items: CartCandidate[],
): Promise<CartBuildResult> {
  const pairs: string[] = [];
  const added: string[] = [];
  const skipped: string[] = [];

  for (const item of items) {
    const handleMatch = item.url?.match(/\/products\/([^/?#\s]+)/);
    const handle = handleMatch?.[1] ?? item.sku?.trim().toLowerCase().replace(/\s+/g, "-");
    if (!handle) {
      skipped.push(item.name);
      continue;
    }
    try {
      const res = await fetch(`${base}/products/${encodeURIComponent(handle)}.js`, fetchOpts());
      if (!res.ok) throw new Error("not found");
      const product = (await res.json()) as ShopifyProductJs;
      const wanted = item.sku?.toLowerCase();
      const variant =
        product.variants.find((v) => v.sku?.toLowerCase() === wanted) ?? product.variants[0];
      if (!variant?.available) {
        skipped.push(item.name);
        continue;
      }
      pairs.push(`${variant.id}:${item.quantity}`);
      added.push(item.name);
    } catch {
      skipped.push(item.name);
    }
  }

  return { url: pairs.length > 0 ? `${base}/cart/${pairs.join(",")}` : null, added, skipped };
}

/** Look up a product by SKU, handle, or pasted product URL. */
export async function lookupShopifyProduct(
  base: string,
  query: string,
): Promise<ShopifyLookupResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  // a pasted product URL carries the handle directly
  const urlMatch = trimmed.match(/\/products\/([^/?#\s]+)/);
  const guess = (urlMatch?.[1] ?? trimmed).toLowerCase().replace(/\s+/g, "-");

  let product = await fetchProduct(base, guess);
  if (!product) {
    const handle = await findHandle(base, trimmed);
    if (handle) product = await fetchProduct(base, handle);
  }
  if (!product) return null;

  // prefer the variant whose SKU matches what the user typed
  const wanted = trimmed.toLowerCase();
  const variant =
    product.variants.find((v) => v.sku?.toLowerCase() === wanted) ?? product.variants[0];
  const price = variant ? parseFloat(variant.price) : NaN;

  return {
    name: product.title,
    sku: variant?.sku || (urlMatch ? null : trimmed),
    url: `${base}/products/${product.handle}`,
    unitPrice: Number.isFinite(price) ? price : null,
    imageUrl: product.image?.src ?? product.images?.[0]?.src ?? null,
  };
}
