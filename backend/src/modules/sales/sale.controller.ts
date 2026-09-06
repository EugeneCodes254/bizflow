import { Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import {
  createSale,
  getSaleById,
  getSales,
} from "./sale.service";

const createSaleSchema = z.object({
  customerId: z.string().optional(),

  items: z
    .array(
      z.object({
        productId: z.string().min(1, "Product ID is required"),
        quantity: z.number().positive("Quantity must be greater than zero"),
      }),
    )
    .min(1, "A sale must contain at least one item"),

  discount: z.number().nonnegative().optional(),

  tax: z.number().nonnegative().optional(),

  paymentMethod: z
    .enum(["MPESA", "CASH", "BANK", "CARD", "OTHER"])
    .optional(),

  paymentAmount: z.number().nonnegative().optional(),

  notes: z.string().optional(),
});

function getBusinessId(req: AuthenticatedRequest) {
  return req.user?.businessId;
}

export async function create(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const businessId = getBusinessId(req);

    if (!businessId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const parsed = createSaleSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid sale data",
        errors: parsed.error.flatten(),
      });
    }

    const sale = await createSale(
      businessId,
      parsed.data,
    );

    return res.status(201).json({
      success: true,
      message: "Sale created successfully",
      data: sale,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create sale";

    if (
      message === "Customer not found" ||
      message === "One or more products were not found" ||
      message === "Product not found"
    ) {
      return res.status(404).json({
        success: false,
        message,
      });
    }

    if (
      message.includes("Insufficient stock") ||
      message.includes("Stock changed while processing")
    ) {
      return res.status(409).json({
        success: false,
        message,
      });
    }

    if (
      message.includes("cannot") ||
      message.includes("must") ||
      message.includes("greater than")
    ) {
      return res.status(400).json({
        success: false,
        message,
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to create sale",
    });
  }
}

export async function list(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const businessId = getBusinessId(req);

    if (!businessId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const sales = await getSales(businessId);

    return res.status(200).json({
      success: true,
      message: "Sales retrieved successfully",
      data: sales,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve sales",
    });
  }
}

export async function getOne(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const businessId = getBusinessId(req);

    if (!businessId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const saleId =
      typeof req.params.id === "string"
        ? req.params.id
        : undefined;

    if (!saleId) {
      return res.status(400).json({
        success: false,
        message: "Sale ID is required",
      });
    }

    const sale = await getSaleById(
      businessId,
      saleId,
    );

    return res.status(200).json({
      success: true,
      message: "Sale retrieved successfully",
      data: sale,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to retrieve sale";

    if (message === "Sale not found") {
      return res.status(404).json({
        success: false,
        message,
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve sale",
    });
  }
}
