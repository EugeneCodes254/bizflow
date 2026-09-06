import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

interface SaleItemInput {
  productId: string;
  quantity: number;
}

interface CreateSaleInput {
  customerId?: string;
  items: SaleItemInput[];
  discount?: number;
  tax?: number;
  paymentMethod?: "MPESA" | "CASH" | "BANK" | "CARD" | "OTHER";
  paymentAmount?: number;
  notes?: string;
}

function generateSaleNumber() {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(1000 + Math.random() * 9000);

  return `SALE-${timestamp}-${random}`;
}

export async function createSale(
  businessId: string,
  input: CreateSaleInput,
) {
  if (!input.items.length) {
    throw new Error("A sale must contain at least one item");
  }

  if (input.discount !== undefined && input.discount < 0) {
    throw new Error("Discount cannot be negative");
  }

  if (input.tax !== undefined && input.tax < 0) {
    throw new Error("Tax cannot be negative");
  }

  if (
    input.paymentAmount !== undefined &&
    input.paymentAmount < 0
  ) {
    throw new Error("Payment amount cannot be negative");
  }

  return prisma.$transaction(async (tx) => {
    // Verify customer belongs to this business.
    if (input.customerId) {
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
    }

    const productIds = input.items.map((item) => item.productId);

    const products = await tx.product.findMany({
      where: {
        id: {
          in: productIds,
        },
        businessId,
        isActive: true,
      },
    });

    if (products.length !== new Set(productIds).size) {
      throw new Error("One or more products were not found");
    }

    const productMap = new Map(
      products.map((product) => [product.id, product]),
    );

    let subtotal = new Prisma.Decimal(0);

    const preparedItems = input.items.map((item) => {
      if (item.quantity <= 0) {
        throw new Error("Quantity must be greater than zero");
      }

      const product = productMap.get(item.productId);

      if (!product) {
        throw new Error("Product not found");
      }

      const availableStock = Number(product.stockQuantity);

      if (availableStock < item.quantity) {
        throw new Error(
          `Insufficient stock for ${product.name}. Available: ${availableStock}`,
        );
      }

      const unitPrice = Number(product.sellingPrice);
      const buyingPrice = Number(product.buyingPrice);
      const total = unitPrice * item.quantity;

      subtotal = subtotal.add(total);

      return {
        product,
        quantity: item.quantity,
        unitPrice,
        buyingPrice,
        total,
      };
    });

    const discount = new Prisma.Decimal(input.discount ?? 0);
    const tax = new Prisma.Decimal(input.tax ?? 0);
    const total = subtotal.sub(discount).add(tax);

    if (total.isNegative()) {
      throw new Error("Discount cannot exceed the sale amount");
    }

    const paymentAmount =
      input.paymentAmount !== undefined
        ? new Prisma.Decimal(input.paymentAmount)
        : input.paymentMethod
          ? total
          : new Prisma.Decimal(0);

    if (paymentAmount.greaterThan(total)) {
      throw new Error("Payment amount cannot exceed sale total");
    }

    const sale = await tx.sale.create({
      data: {
        businessId,
        customerId: input.customerId,
        saleNumber: generateSaleNumber(),
        subtotal,
        discount,
        tax,
        total,
        paymentMethod: input.paymentMethod,
        notes: input.notes?.trim() || undefined,
        items: {
          create: preparedItems.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            buyingPrice: item.buyingPrice,
            total: item.total,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
      },
    });

    // Reduce stock only after the sale has been created.
    for (const item of preparedItems) {
      const updatedProduct = await tx.product.updateMany({
        where: {
          id: item.product.id,
          businessId,
          isActive: true,
          stockQuantity: {
            gte: item.quantity,
          },
        },
        data: {
          stockQuantity: {
            decrement: item.quantity,
          },
        },
      });

      if (updatedProduct.count !== 1) {
        throw new Error(
          `Stock changed while processing ${item.product.name}. Please try again`,
        );
      }
    }

    // Record payment when a payment method is supplied.
    if (input.paymentMethod && paymentAmount.greaterThan(0)) {
      await tx.payment.create({
        data: {
          businessId,
          customerId: input.customerId,
          saleId: sale.id,
          amount: paymentAmount,
          method: input.paymentMethod,
          status: "COMPLETED",
        },
      });
    }

    const refreshedSale = await tx.sale.findUnique({
      where: {
        id: sale.id,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
        payments: true,
      },
    });

    return {
      ...refreshedSale,
      paymentAmount,
      balanceDue: total.sub(paymentAmount),
    };
  });
}

export async function getSaleById(
  businessId: string,
  saleId: string,
) {
  const sale = await prisma.sale.findFirst({
    where: {
      id: saleId,
      businessId,
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

  if (!sale) {
    throw new Error("Sale not found");
  }

  return sale;
}

export async function getSales(
  businessId: string,
) {
  return prisma.sale.findMany({
    where: {
      businessId,
    },
    orderBy: {
      soldAt: "desc",
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
}
