import { eq, and, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { products, categories } from '../db/schema.js';

export async function getActiveCategories() {
  return db.query.categories.findMany({
    where: eq(categories.isActive, true),
    orderBy: [asc(categories.sortOrder)],
  });
}

export async function getProductsByCategory(categoryId: number) {
  return db.query.products.findMany({
    where: and(eq(products.categoryId, categoryId), eq(products.isActive, true)),
    orderBy: [asc(products.sortOrder)],
  });
}

export async function getProductById(id: number) {
  return db.query.products.findFirst({
    where: eq(products.id, id),
  });
}

export async function getCategoryById(id: number) {
  return db.query.categories.findFirst({
    where: eq(categories.id, id),
  });
}
