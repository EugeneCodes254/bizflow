import { prisma } from "../../lib/prisma";
import { Prisma } from "@prisma/client";

interface CreatePaymentInput {
  invoiceId: string;
  amount: number;
  method: "MPESA" | "CASH" | "BANK" | "CARD" | "OTHER";
  reference?: string;
  phoneNumber?: string;
  notes?: string;
}

function money(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

function calculateInvoiceStatus(
  total: Prisma.Decimal,
  amountPaid: Prisma.Decimal,
  dueDate: Date | null,
  currentStatus: string,
) {
  if (currentStatus === "CANCELLED") {
    return "CANCELLED" as const;
  }

  if (amountPaid.greaterThanOrEqualTo(total)) {
    return "PAID" as const;
  }

  if (dueDate && dueDate.getTime() < Date.now()) {
    return "OVERDUE" as const;
  }

  if (amountPaid.greaterThan(0)) {
    return "PARTIALLY_PAID" as const;
  }

  return currentStatus as
    | "DRAFT"
    | "SENT"
    | "PARTIALLY_PAID"
    | "PAID"
    | "OVERDUE"
    | "CANCELLED";
}

export async function createPayment(
  businessId: string,
  input: CreatePaymentInput,
) {
  if (!input.invoiceId) {
    throw new Error("Invoice is required");
  }

  if (input.amount <= 0) {
    throw new Error("Payment amount must be greater than zero");
  }

  const reference = input.reference?.trim() || undefined;
  const phoneNumber = input.phoneNumber?.trim() || undefined;
  const notes = input.notes?.trim() || undefined;

  return prisma.$transaction(
    async (tx) => {
    /*
     * Application-level duplicate check.
     *
     * The database UNIQUE constraint remains the final protection
     * against race conditions where two requests arrive simultaneously.
     */
    if (reference) {
      const existingPayment = await tx.payment.findFirst({
        where: {
          businessId,
          reference,
        },
      });

      if (existingPayment) {
        throw new Error(
          "A payment with this reference already exists.",
        );
      }
    }

    const invoice = await tx.invoice.findFirst({
      where: {
        id: input.invoiceId,
        businessId,
      },
      include: {
        customer: true,
      },
    });

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    if (invoice.status === "CANCELLED") {
      throw new Error("Cannot pay a cancelled invoice");
    }

    if (invoice.status === "DRAFT") {
      throw new Error(
        "Cannot pay a draft invoice. Send the invoice first.",
      );
    }

    if (
      invoice.status === "PAID" ||
      invoice.amountPaid.greaterThanOrEqualTo(invoice.total)
    ) {
      throw new Error("Invoice is already fully paid");
    }

    const amount = money(input.amount);

    const balanceBefore = invoice.total.sub(
      invoice.amountPaid,
    );

    if (amount.greaterThan(balanceBefore)) {
      throw new Error(
        `Payment exceeds balance due. Balance due: ${balanceBefore.toFixed(2)}`,
      );
    }

    const newAmountPaid = invoice.amountPaid.add(amount);

    const newBalance = invoice.total.sub(newAmountPaid);

    const newStatus = calculateInvoiceStatus(
      invoice.total,
      newAmountPaid,
      invoice.dueDate,
      invoice.status,
    );

    let payment;

    try {
      payment = await tx.payment.create({
        data: {
          businessId,
          customerId: invoice.customerId,
          invoiceId: invoice.id,
          amount,
          method: input.method,
          status: "COMPLETED",
          reference,
          phoneNumber,
          notes,
        },
      });
    } catch (error) {
      /*
       * The database UNIQUE constraint is the final authority.
       * P2002 means another request created the same reference,
       * including a race between simultaneous requests.
       */
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new Error(
          "A payment with this reference already exists.",
        );
      }

      throw error;
    }

    const updatedInvoice = await tx.invoice.update({
      where: {
        id: invoice.id,
      },
      data: {
        amountPaid: newAmountPaid,
        status: newStatus,
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
        payments: {
          orderBy: {
            paidAt: "desc",
          },
        },
      },
    });

    const updatedCustomer = await tx.customer.update({
      where: {
        id: invoice.customerId,
      },
      data: {
        outstanding: {
          decrement: amount,
        },
      },
    });

      return {
        payment,
        invoice: {
          ...updatedInvoice,
          balanceDue: newBalance,
        },
        customer: updatedCustomer,
        balanceBefore,
        paymentAmount: amount,
        balanceAfter: newBalance,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

export async function getPayments(
  businessId: string,
) {
  return prisma.payment.findMany({
    where: {
      businessId,
    },
    orderBy: {
      paidAt: "desc",
    },
    include: {
      customer: true,
      invoice: true,
      sale: true,
    },
  });
}

export async function getPaymentById(
  businessId: string,
  paymentId: string,
) {
  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      businessId,
    },
    include: {
      customer: true,
      invoice: {
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      },
      sale: true,
    },
  });

  if (!payment) {
    throw new Error("Payment not found");
  }

  return payment;
}
