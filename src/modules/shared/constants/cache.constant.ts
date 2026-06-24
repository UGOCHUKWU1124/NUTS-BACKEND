// ── Cache Key Generators ──────────────────────────────────────────
export const CATEGORY_TREE = () => 'category:tree';
export const CATEGORY_BY_SLUG = (slug: string) => `category:${slug}`;
export const PRODUCTS_PUBLIC = (page: number, limit: number) =>
  `products:public:page:${page}:limit:${limit}`;
export const PRODUCT_BY_SLUG = (slug: string) => `product:${slug}`;
export const CREATOR_STORE = (storeSlug: string) =>
  `creator:store:${storeSlug}`;
export const CREATOR_STORE_PRODUCTS = (storeSlug: string) =>
  `creator:store:${storeSlug}:products`;

// ── TTL Constants ─────────────────────────────────────────────────
export const CATEGORY_TTL = 3600; // 1 hour
export const PRODUCT_TTL = 1800; // 30 minutes
export const CREATOR_STORE_TTL = 3600; // 1 hour
