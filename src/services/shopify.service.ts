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
}

interface ShopifyProduct {
  title: string;
  handle: string;
  variants: { sku: string | null; price: string }[];
}

const FETCH_OPTS: RequestInit = {
  headers: { accept: "application/json", "user-agent": "BearParts BOM lookup" },
  signal: AbortSignal.timeout(8000),
};

async function fetchProduct(base: string, handle: string): Promise<ShopifyProduct | null> {
  const res = await fetch(`${base}/products/${encodeURIComponent(handle)}.json`, FETCH_OPTS);
  if (!res.ok) return null;
  const json = (await res.json()) as { product?: ShopifyProduct };
  return json.product ?? null;
}

async function findHandle(base: string, query: string): Promise<string | null> {
  const res = await fetch(
    `${base}/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product`,
    FETCH_OPTS,
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    resources?: { results?: { products?: { handle?: string }[] } };
  };
  return json.resources?.results?.products?.[0]?.handle ?? null;
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
  };
}
