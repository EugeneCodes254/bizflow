import { prisma } from "../../lib/prisma";
import { Prisma } from "@prisma/client";

interface CreateExpenseInput {
  description: string;
  amount: number;
  category: string;
  paymentMethod: "MPESA" | "CASH" | "BANK" | "CARD" | "OTHER";
  expenseDate?: string;
  supplierId?: string;
  notes?: string;
}

interface UpdateExpenseInput {
  description?: string;
  amount?: number;
  category?: string;
  paymentMethod?: "MPESA" | "CASH" | "BANK" | "CARD" | "OTHER";
  expenseDate?: string;
  supplierId?: string;
  notes?: string;
}

function money(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

export async function createExpense(
  businessId: string,
  input: CreateExpenseInput,
) {
  if (!input.description?.trim()) {
    throw new Error("Expense description is required");
  }

  if (input.amount <= 0) {
    throw new Error("Expense amount must be greater than zero");
  }

  if (!input.category?.trim()) {
    throw new Error("Expense category is required");
  }

  return prisma.$transaction(async (tx) => {
    if (input.supplierId) {
      const supplier = await tx.supplier.findFirst({
        where: {
          id: input.supplierId,
          businessId,
          isActive: true,
        },
      });

      if (!supplier) {
        throw new Error("Supplier not found");
      }
    }

    let expenseDate = new Date();

    if (input.expenseDate) {
      expenseDate = new Date(input.expenseDate);

      if (Number.isNaN(expenseDate.getTime())) {
        throw new Error("Invalid expense date");
      }
    }

    const expense = await tx.expense.create({
      data: {
        businessId,
        description: input.description.trim(),
        amount: money(input.amount),
        category: input.category.trim(),
        paymentMethod: input.paymentMethod,
        expenseDate,
        supplierId: input.supplierId,
        notes: input.notes?.trim() || undefined,
        status: "RECORDED",
      },
      include: {
        supplier: true,
      },
    });

    return expense;
  });
}

export async function getExpenseById(
  businessId: string,
  expenseId: string,
) {
  const expense = await prisma.expense.findFirst({
    where: {
      id: expenseId,
      businessId,
    },
    include: {
      supplier: true,
    },
  });

  if (!expense) {
    throw new Error("Expense not found");
  }

  return expense;
}

export async function getExpenses(
  businessId: string,
) {
  return prisma.expense.findMany({
    where: {
      businessId,
    },
    orderBy: {
      expenseDate: "desc",
    },
    include: {
      supplier: true,
    },
  });
}

export async function updateExpense(
  businessId: string,
  expenseId: string,
  input: UpdateExpenseInput,
) {
  const existing = await prisma.expense.findFirst({
    where: {
      id: expenseId,
      businessId,
    },
  });

  if (!existing) {
    throw new Error("Expense not found");
  }

  if (
    input.description !== undefined &&
    !input.description.trim()
  ) {
    throw new Error("Expense description is required");
  }

  if (
    input.amount !== undefined &&
    input.amount <= 0
  ) {
    throw new Error(
      "Expense amount must be greater than zero",
    );
  }

  if (
    input.category !== undefined &&
    !input.category.trim()
  ) {
    throw new Error("Expense category is required");
  }

  if (input.supplierId) {
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: input.supplierId,
        businessId,
        isActive: true,
      },
    });

    if (!supplier) {
      throw new Error("Supplier not found");
    }
  }

  let expenseDate: Date | undefined;

  if (input.expenseDate) {
    expenseDate = new Date(input.expenseDate);

    if (Number.isNaN(expenseDate.getTime())) {
      throw new Error("Invalid expense date");
    }
  }

  return prisma.expense.update({
    where: {
      id: expenseId,
    },
    data: {
      description:
        input.description?.trim() ?? undefined,
      amount:
        input.amount !== undefined
          ? money(input.amount)
          : undefined,
      category:
        input.category?.trim() ?? undefined,
      paymentMethod:
        input.paymentMethod ?? undefined,
      expenseDate,
      supplierId:
        input.supplierId ?? undefined,
      notes:
        input.notes !== undefined
          ? input.notes.trim() || null
          : undefined,
    },
    include: {
      supplier: true,
    },
  });
}

export async function deleteExpense(
  businessId: string,
  expenseId: string,
) {
  const existing = await prisma.expense.findFirst({
    where: {
      id: expenseId,
      businessId,
    },
  });

  if (!existing) {
    throw new Error("Expense not found");
  }

  return prisma.expense.update({
    where: {
      id: expenseId,
    },
    data: {
      status: "VOIDED",
    },
    include: {
      supplier: true,
    },
  });
}
