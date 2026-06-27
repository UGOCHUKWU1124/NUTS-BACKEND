export function generateSlug(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .normalize('NFD') // Split an accented letter in the base letter and the accent
    .replace(/[\u0300-\u036f]/g, '') // Remove all previously split accents
    .toLowerCase()
    .trim()
    .replace(/\s*&\s*/g, '-and-') // Convert & (with optional surrounding spaces) to -and-
    .replace(/[^a-z0-9 -]/g, '') // Remove all non-word characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple consecutive hyphens with a single hyphen
    .replace(/^-+|-+$/g, ''); // Trim leading/trailing hyphens
}
