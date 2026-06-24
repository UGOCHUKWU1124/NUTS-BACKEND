export function getPagination(page: number, limit: number) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), 100);

  const skip = (safePage - 1) * safeLimit;

  return {
    skip,
    take: safeLimit,
  };
}
