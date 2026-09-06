import { Request, Response } from "express";
import { z } from "zod";
import {
  createExpense,
  getExpenseById,
  getExpenses,
  updateExpense,
  deleteExpense,
} from "./expense.service";

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    businessId: string;
    role: string;
  };
}

const createExpenseSchema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
  category: z.string().min(1),
  paymentMethod: z.enum([
    "MPESA",
    "CASH",
    "BANK",
    "CARD",
    "OTHER",
  ]),
  expenseDate: z.string().optional(),
  supplierId: z.string().optional(),
  notes: z.string().optional(),
});

const updateExpenseSchema = z.object({
  description: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  category: z.string().min(1).optional(),
  paymentMethod: z.enum([
    "MPESA",
    "CASH",
    "BANK",
    "CARD",
    "OTHER",
  ]).optional(),
  expenseDate: z.string().optional(),
  supplierId: z.string().optional(),
  notes: z.string().optional(),
});

export async function create(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user?.businessId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const input = createExpenseSchema.parse(req.body);

    const expense = await createExpense(
      req.user.businessId,
      input,
    );

    return res.status(201).json({
      success: true,
      data: expense,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense data",
        errors: error.flatten(),
      });
    }

    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create expense",
    });
  }
}

export async function list(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    if (!req.user?.businessId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const expenses = await getExpenses(req.user.businessId);

    return res.json({
      success: true,
      data: expenses,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch expenses",
    });
  }
}

export async function getOne(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    if (!req.user?.businessId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const expense = await getExpenseById(
      req.user.businessId,
      String(req.params.id),
    );

    return res.json({
      success: true,
      data: expense,
    });
  } catch (error) {
    return res.status(404).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Expense not found",
    });
  }
}

export async function update(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    if (!req.user?.businessId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const input = updateExpenseSchema.parse(req.body);

    const expense = await updateExpense(
      req.user.businessId,
      String(req.params.id),
      input,
    );

    return res.json({
      success: true,
      data: expense,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense data",
        errors: error.flatten(),
      });
    }

    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update expense",
    });
  }
}

export async function remove(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    if (!req.user?.businessId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const expense = await deleteExpense(
      req.user.businessId,
      String(req.params.id),
    );

    return res.json({
      success: true,
      message: "Expense voided successfully",
      data: expense,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to void expense",
    });
  }
}
