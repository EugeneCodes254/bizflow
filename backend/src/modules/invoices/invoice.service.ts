import { prisma } from "../../lib/prisma";
import { Prisma } from "@prisma/client";

interface InvoiceItemInput {
  productId?: string;
  description: string;
  quantity: number;
  unitPrice?: number;
}

interface CreateInvoiceInput {
  customerId: string;
  items: InvoiceItemInput[];
  discount?: number;
  tax?: number;
  dueDate?: string;
  notes?: string;
  status?: "DRAFT" | "SENT";
}

function generateInvoiceNumber() {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(1000 + Math.random() * 9000);

  return `INV-${timestamp}-${random}`;
}

function money(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

export async function createInvoice(
  businessId: string,
  input: CreateInvoiceInput,
) {
  if (!input.customerId) {
    throw new Error("Customer is required");
  }

  if (!input.items.length) {
    throw new Error("An invoice must contain at least one item");
  }

  if (input.discount !== undefined && input.discount < 0) {
    throw new Error("Discount cannot be negative");
  }

  if (input.tax !== undefined && input.tax < 0) {
    throw new Error("Tax cannot be negative");
  }

  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({
      where: {
        id: input.customerId,
        businessId,
        isActive: true,
      },
    });

    if (!customer) {
      throw new Error("Customer not found");
    }

    const productIds = input.items
      .map((item) => item.productId)
      .filter(
        (id): id is string => Boolean(id),
      );

    const products =
      productIds.length > 0
        ? await tx.product.findMany({
            where: {
              id: {
                in: productIds,
              },
              businessId,
              isActive: true,
            },
          })
        : [];

    const productMap = new Map(
      products.map((product) => [
        product.id,
        product,
      ]),
    );

    const preparedItems = input.items.map((item) => {
      if (!item.description.trim()) {
        throw new Error(
          "Invoice item description is required",
        );
      }

      if (item.quantity <= 0) {
        throw new Error(
          "Invoice item quantity must be greater than zero",
        );
      }

      let unitPrice = item.unitPrice;

      if (item.productId) {
        const product = productMap.get(item.productId);

        if (!product) {
          throw new Error(
            "One or more invoice products were not found",
          );
        }

        unitPrice = Number(product.sellingPrice);
      }

      if (unitPrice === undefined) {
        throw new Error(
          "Unit price is required when no product is selected",
        );
      }

      if (unitPrice < 0) {
        throw new Error(
          "Unit price cannot be negative",
        );
      }

      const quantity = new Prisma.Decimal(
        item.quantity,
      );

      const price = money(unitPrice);
      const total = quantity.mul(price);

      return {
        productId: item.productId,
        description: item.description.trim(),
        quantity,
        unitPrice: price,
        total,
      };
    });

    const subtotal = preparedItems.reduce(
      (sum, item) =>
        sum.add(item.total),
      new Prisma.Decimal(0),
    );

    const discount = money(
      input.discount ?? 0,
    );

    const tax = money(
      input.tax ?? 0,
    );

    const total = subtotal
      .sub(discount)
      .add(tax);

    if (total.lessThan(0)) {
      throw new Error(
        "Discount cannot exceed the invoice amount",
      );
    }

    let dueDate: Date | undefined;

    if (input.dueDate) {
      dueDate = new Date(input.dueDate);

      if (Number.isNaN(dueDate.getTime())) {
        throw new Error("Invalid due date");
      }
    }

    const invoice = await tx.invoice.create({
      data: {
        businessId,
        customerId: input.customerId,
        invoiceNumber: generateInvoiceNumber(),
        status: input.status ?? "DRAFT",
        subtotal,
        discount,
        tax,
        total,
        amountPaid: new Prisma.Decimal(0),
        dueDate,
        notes: input.notes?.trim() || undefined,

        items: {
          create: preparedItems.map((item) => ({
            productId: item.productId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
          })),
        },
      },

      include: {
        customer: true,

        items: {
          include: {
            product: true,
          },
        },

        payments: true,
      },
    });

    // Only SENT invoices create a customer receivable.
    // DRAFT invoices are not yet owed by the customer.
    let updatedCustomer = customer;

    if (invoice.status === "SENT") {
      updatedCustomer =
        await tx.customer.update({
          where: {
            id: customer.id,
          },
          data: {
            outstanding: {
              increment: total,
            },
          },
        });
    }

    return {
      ...invoice,

      customer: updatedCustomer,

      balanceDue:
        total.sub(invoice.amountPaid),
    };
  });
}


export async function updateInvoiceStatus(
  businessId: string,
  invoiceId: string,
  newStatus: "SENT" | "CANCELLED",
) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: {
        id: invoiceId,
        businessId,
      },
      include: {
        customer: true,
        payments: true,
      },
    });

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    if (invoice.status === "CANCELLED") {
      throw new Error("Cancelled invoices cannot be changed");
    }

    if (newStatus === "SENT") {
      if (invoice.status !== "DRAFT") {
        throw new Error(
          `Invoice cannot be sent from ${invoice.status} status`,
        );
      }

      const updatedInvoice = await tx.invoice.update({
        where: {
          id: invoice.id,
        },
        data: {
          status: "SENT",
        },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
            },
          },
          payments: true,
        },
      });

      const updatedCustomer = await tx.customer.update({
        where: {
          id: invoice.customerId,
        },
        data: {
          outstanding: {
            increment: invoice.total.sub(invoice.amountPaid),
          },
        },
      });

      return {
        ...updatedInvoice,
        customer: updatedCustomer,
        balanceDue: updatedInvoice.total.sub(updatedInvoice.amountPaid),
      };
    }

    if (newStatus === "CANCELLED") {
      if (invoice.amountPaid.greaterThan(0)) {
        throw new Error(
          "Invoices with payments cannot be cancelled. Refund or credit handling is required first.",
        );
      }

      const balanceDue = invoice.total.sub(invoice.amountPaid);

      const updatedInvoice = await tx.invoice.update({
        where: {
          id: invoice.id,
        },
        data: {
          status: "CANCELLED",
        },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
            },
          },
          payments: true,
        },
      });

      let updatedCustomer = invoice.customer;

      if (invoice.status !== "DRAFT" && balanceDue.greaterThan(0)) {
        updatedCustomer = await tx.customer.update({
          where: {
            id: invoice.customerId,
          },
          data: {
            outstanding: {
              decrement: balanceDue,
            },
          },
        });
      }

      return {
        ...updatedInvoice,
        customer: updatedCustomer,
        balanceDue: new Prisma.Decimal(0),
      };
    }

    throw new Error("Invalid invoice status");
  });
}

export async function getInvoiceById(
  businessId: string,
  invoiceId: string,
) {
  const invoice =
    await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        businessId,
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

  if (!invoice) {
    throw new Error("Invoice not found");
  }

  const balanceDue =
    invoice.total.sub(
      invoice.amountPaid,
    );

  return {
    ...invoice,
    balanceDue,
  };
}

export async function getInvoices(
  businessId: string,
) {
  const invoices =
    await prisma.invoice.findMany({
      where: {
        businessId,
      },

      orderBy: {
        createdAt: "desc",
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

  return invoices.map(
    (invoice) => ({
      ...invoice,

      balanceDue:
        invoice.total.sub(
          invoice.amountPaid,
        ),
    }),
  );
}
