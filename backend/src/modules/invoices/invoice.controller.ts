import { Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { createInvoice, getInvoiceById, getInvoices, updateInvoiceStatus } from "./invoice.service";

const createInvoiceSchema = z.object({
  customerId: z.string().min(1, "Customer ID is required"),

  items: z
    .array(
      z.object({
        productId: z.string().min(1).optional(),
        description: z
          .string()
          .min(1, "Description is required"),
        quantity: z
          .number()
          .positive(
            "Quantity must be greater than zero",
          ),
        unitPrice: z
          .number()
          .nonnegative()
          .optional(),
      }),
    )
    .min(
      1,
      "An invoice must contain at least one item",
    ),

  discount: z
    .number()
    .nonnegative()
    .optional(),

  tax: z
    .number()
    .nonnegative()
    .optional(),

  dueDate: z
    .string()
    .optional(),

  notes: z
    .string()
    .optional(),

  status: z
    .enum(["DRAFT", "SENT"])
    .optional(),
});

function getBusinessId(
  req: AuthenticatedRequest,
) {
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

    const parsed =
      createInvoiceSchema.safeParse(
        req.body,
      );

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice data",
        errors:
          parsed.error.flatten(),
      });
    }

    const invoice =
      await createInvoice(
        businessId,
        parsed.data,
      );

    return res.status(201).json({
      success: true,
      message:
        "Invoice created successfully",
      data: invoice,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create invoice";

    if (
      message ===
        "Customer not found" ||
      message ===
        "One or more invoice products were not found"
    ) {
      return res.status(404).json({
        success: false,
        message,
      });
    }

    if (
      message.includes("required") ||
      message.includes("cannot") ||
      message.includes("must") ||
      message.includes("greater than") ||
      message.includes("exceed") ||
      message.includes("Invalid due date")
    ) {
      return res.status(400).json({
        success: false,
        message,
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Failed to create invoice",
    });
  }
}

export async function list(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const businessId =
      getBusinessId(req);

    if (!businessId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const invoices =
      await getInvoices(
        businessId,
      );

    return res.status(200).json({
      success: true,
      message:
        "Invoices retrieved successfully",
      data: invoices,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Failed to retrieve invoices",
    });
  }
}

export async function getOne(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const businessId =
      getBusinessId(req);

    if (!businessId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const invoiceId =
      typeof req.params.id === "string"
        ? req.params.id
        : undefined;

    if (!invoiceId) {
      return res.status(400).json({
        success: false,
        message:
          "Invoice ID is required",
      });
    }

    const invoice =
      await getInvoiceById(
        businessId,
        invoiceId,
      );

    return res.status(200).json({
      success: true,
      message:
        "Invoice retrieved successfully",
      data: invoice,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to retrieve invoice";

    if (
      message === "Invoice not found"
    ) {
      return res.status(404).json({
        success: false,
        message,
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Failed to retrieve invoice",
    });
  }
}


export async function updateStatus(req: any, res: any) {
  try {
    const businessId = req.user.businessId;

    const invoice = await updateInvoiceStatus(
      businessId,
      req.params.id,
      req.body.status,
    );

    res.status(200).json({
      success: true,
      message: `Invoice status updated to ${req.body.status}`,
      data: invoice,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || "Failed to update invoice status",
    });
  }
}
