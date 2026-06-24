export interface CartAbandonmentRateDto {
  rate: number;
  abandonedCarts: number;
  totalCarts: number;
}

export interface SearchAnalyticsDto {
  totalSearches: number;
  zeroResultSearches: number;
  zeroResultRate: number;
  topSearches: { query: string; count: number }[];
}

export interface ProductViewAnalyticsDto {
  totalViews: number;
  uniqueProducts: number;
  topViewed: { productId: string; productName: string; views: number }[];
}

export interface DashboardAnalyticsDto {
  cartAbandonmentRate: CartAbandonmentRateDto;
  searchAnalytics: SearchAnalyticsDto;
  productViews: ProductViewAnalyticsDto;
  totalRevenue: number;
  totalOrders: number;
  totalUsers: number;
}
