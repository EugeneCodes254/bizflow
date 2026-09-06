import { Request, Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import {
  createProduct,
  deactivateProduct,
  getProductById,
  getProducts,
  updateProduct,
} from "./product.service";

const createProductSchema = z.object({
  name: z.string().trim().min(2).max(150),
  sku: z.string().trim().max(100).optional(),
  description: z.string().trim().max(500).optional(),
  category: z.string().trim().max(100).optional(),
  unit: z.string().trim().max(50).optional(),
  buyingPrice: z.number().nonnegative(),
  sellingPrice: z.number().nonnegative(),
  stockQuantity: z.number().nonnegative().optional(),
  lowStockLevel: z.number().nonnegative().optional(),
});

const updateProductSchema = createProductSchema.partial().extend({
  isActive: z.boolean().optional(),
});

function getBusinessId(req: AuthenticatedRequest) {
  if (!req.user?.businessId) {
    throw new Error("Authentication required");
  }

  return req.user.businessId;
}

export async function create(req: AuthenticatedRequest, res: Response) {
  try {
    const businessId = getBusinessId(req);
    const input = createProductSchema.parse(req.body);

    const product = await createProduct(businessId, input);

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: "Invalid product data",
        errors: error.issues,
      });
      return;
    }

    if (
      error instanceof Error &&
      error.message === "A product with this SKU already exists"
    ) {
      res.status(409).json({
        success: false,
        message: error.message,
      });
      return;
    }

    console.error("Create product error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to create product",
    });
  }
}

export async function list(req: AuthenticatedRequest, res: Response) {
  try {
    const businessId = getBusinessId(req);

    const products = await getProducts(businessId);

    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error("List products error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve products",
    });
  }
}

export async function getOne(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const businessId = getBusinessId(req);
    const productId = typeof req.params.id === "string" ? req.params.id : undefined;

    if (!productId) {
      res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
      return;
    }

    const product = await getProductById(businessId, productId);

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Product not found"
    ) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
      return;
    }

    console.error("Get product error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve product",
    });
  }
}

export async function update(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const businessId = getBusinessId(req);
    const productId = typeof req.params.id === "string" ? req.params.id : undefined;

    if (!productId) {
      res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
      return;
    }

    const input = updateProductSchema.parse(req.body);

    const product = await updateProduct(
      businessId,
      productId,
      input,
    );

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: "Invalid product data",
        errors: error.issues,
      });
      return;
    }

    if (
      error instanceof Error &&
      error.message === "Product not found"
    ) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
      return;
    }

    if (
      error instanceof Error &&
      error.message === "A product with this SKU already exists"
    ) {
      res.status(409).json({
        success: false,
        message: error.message,
      });
      return;
    }

    console.error("Update product error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to update product",
    });
  }
}

export async function remove(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const businessId = getBusinessId(req);
    const productId = typeof req.params.id === "string" ? req.params.id : undefined;

    if (!productId) {
      res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
      return;
    }

    const product = await deactivateProduct(
      businessId,
      productId,
    );

    res.status(200).json({
      success: true,
      message: "Product deactivated successfully",
      data: product,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Product not found"
    ) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
      return;
    }

    console.error("Deactivate product error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to deactivate product",
    });
  }
}
