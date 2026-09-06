import { Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import {
  createPayment,
  getPaymentById,
  getPayments,
} from "./payment.service";

const createPaymentSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required"),

  amount: z
    .number()
    .positive(
      "Payment amount must be greater than zero",
    ),

  method: z.enum([
    "MPESA",
    "CASH",
    "BANK",
    "CARD",
    "OTHER",
  ]),

  reference: z.string().optional(),

  phoneNumber: z.string().optional(),

  notes: z.string().optional(),
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
    const businessId =
      getBusinessId(req);

    if (!businessId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const parsed =
      createPaymentSchema.safeParse(
        req.body,
      );

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment data",
        errors:
          parsed.error.flatten(),
      });
    }

    const result =
      await createPayment(
        businessId,
        parsed.data,
      );

    return res.status(201).json({
      success: true,
      message:
        "Payment recorded successfully",
      data: result,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to record payment";

    if (
      message === "Invoice not found" ||
      message === "Payment not found"
    ) {
      return res.status(404).json({
        success: false,
        message,
      });
    }

    if (
      message.includes("required") ||
      message.includes("greater than") ||
      message.includes("exceeds") ||
      message.includes("already") ||
      message.includes("cancelled") ||
      message.includes("draft")
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
        "Failed to record payment",
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

    const payments =
      await getPayments(
        businessId,
      );

    return res.status(200).json({
      success: true,
      message:
        "Payments retrieved successfully",
      data: payments,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Failed to retrieve payments",
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

    const paymentId =
      typeof req.params.id === "string"
        ? req.params.id
        : undefined;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message:
          "Payment ID is required",
      });
    }

    const payment =
      await getPaymentById(
        businessId,
        paymentId,
      );

    return res.status(200).json({
      success: true,
      message:
        "Payment retrieved successfully",
      data: payment,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to retrieve payment";

    if (
      message === "Payment not found"
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
        "Failed to retrieve payment",
    });
  }
}
