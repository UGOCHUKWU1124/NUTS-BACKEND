// Local mirror of Prisma's CategoryType enum to avoid LSP import-resolution issues.
// Keep in sync with prisma/schema.prisma.
export const CategoryType = {
  Category: 'Category' as const,
  Parentsubcategory: 'Parentsubcategory' as const,
  Subcategory: 'Subcategory' as const,
};

export type CategoryType = (typeof CategoryType)[keyof typeof CategoryType];

export const CATEGORY_DEPTH = {
  CATEGORY: 0,
  PARENTSUBCATEGORY: 1,
  SUBCATEGORY: 2,
} as const;

export const MAX_DEPTH = 2;

export const DEPTH_TO_TYPE: Record<number, CategoryType> = {
  [CATEGORY_DEPTH.CATEGORY]: CategoryType.Category,
  [CATEGORY_DEPTH.PARENTSUBCATEGORY]: CategoryType.Parentsubcategory,
  [CATEGORY_DEPTH.SUBCATEGORY]: CategoryType.Subcategory,
};

export const TYPE_LABEL: Record<CategoryType, string> = {
  [CategoryType.Category]: 'Category',
  [CategoryType.Parentsubcategory]: 'Parent Subcategory',
  [CategoryType.Subcategory]: 'Subcategory',
};
