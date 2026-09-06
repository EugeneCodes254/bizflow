import { prisma } from "../../lib/prisma";

interface CreateProductInput {
  name: string;
  sku?: string;
  description?: string;
  category?: string;
  unit?: string;
  buyingPrice: number;
  sellingPrice: number;
  stockQuantity?: number;
  lowStockLevel?: number;
}

interface UpdateProductInput {
  name?: string;
  sku?: string;
  description?: string;
  category?: string;
  unit?: string;
  buyingPrice?: number;
  sellingPrice?: number;
  stockQuantity?: number;
  lowStockLevel?: number;
  isActive?: boolean;
}

export async function createProduct(
  businessId: string,
  input: CreateProductInput,
) {
  const existingSku = input.sku
    ? await prisma.product.findFirst({
        where: {
          businessId,
          sku: input.sku,
        },
      })
    : null;

  if (existingSku) {
    throw new Error("A product with this SKU already exists");
  }

  return prisma.product.create({
    data: {
      businessId,
      name: input.name.trim(),
      sku: input.sku?.trim() || undefined,
      description: input.description?.trim() || undefined,
      category: input.category?.trim() || undefined,
      unit: input.unit?.trim() || "piece",
      buyingPrice: input.buyingPrice,
      sellingPrice: input.sellingPrice,
      stockQuantity: input.stockQuantity ?? 0,
      lowStockLevel: input.lowStockLevel ?? 5,
    },
  });
}

export async function getProducts(businessId: string) {
  return prisma.product.findMany({
    where: {
      businessId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getProductById(
  businessId: string,
  productId: string,
) {
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      businessId,
    },
  });

  if (!product) {
    throw new Error("Product not found");
  }

  return product;
}

export async function updateProduct(
  businessId: string,
  productId: string,
  input: UpdateProductInput,
) {
  const existingProduct = await prisma.product.findFirst({
    where: {
      id: productId,
      businessId,
    },
  });

  if (!existingProduct) {
    throw new Error("Product not found");
  }

  if (input.sku && input.sku !== existingProduct.sku) {
    const existingSku = await prisma.product.findFirst({
      where: {
        businessId,
        sku: input.sku,
        NOT: {
          id: productId,
        },
      },
    });

    if (existingSku) {
      throw new Error("A product with this SKU already exists");
    }
  }

  return prisma.product.update({
    where: {
      id: productId,
    },
    data: {
      name: input.name?.trim(),
      sku: input.sku?.trim(),
      description: input.description?.trim(),
      category: input.category?.trim(),
      unit: input.unit?.trim(),
      buyingPrice: input.buyingPrice,
      sellingPrice: input.sellingPrice,
      stockQuantity: input.stockQuantity,
      lowStockLevel: input.lowStockLevel,
      isActive: input.isActive,
    },
  });
}

export async function deactivateProduct(
  businessId: string,
  productId: string,
) {
  const existingProduct = await prisma.product.findFirst({
    where: {
      id: productId,
      businessId,
    },
  });

  if (!existingProduct) {
    throw new Error("Product not found");
  }

  return prisma.product.update({
    where: {
      id: productId,
    },
    data: {
      isActive: false,
    },
  });
}
