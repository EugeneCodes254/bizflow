import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

const money = (value: Prisma.Decimal | number | string) =>
  new Prisma.Decimal(value);

export async function getDashboardSummary(
  businessId: string,
  startDate?: Date,
  endDate?: Date,
) {
  const now = new Date();

  const periodStart =
    startDate ??
    new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const periodEnd =
    endDate ??
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const periodDuration = periodEnd.getTime() - periodStart.getTime();

  const previousPeriodEnd = new Date(periodStart.getTime());
  const previousPeriodStart = new Date(
    periodStart.getTime() - periodDuration,
  );

  const [
    sales,
    expenses,
    payments,
    customers,
    products,
    lowStockProducts,
    previousSales,
    previousExpenses,
    previousPayments,
  ] = await Promise.all([
      prisma.sale.findMany({
        where: {
          businessId,
          status: "COMPLETED",
          soldAt: {
            gte: periodStart,
            lt: periodEnd,
          },
        },
        include: {
          items: true,
        },
      }),

      prisma.expense.findMany({
        where: {
          businessId,
          status: "RECORDED",
          expenseDate: {
            gte: periodStart,
            lt: periodEnd,
          },
        },
      }),

      prisma.payment.findMany({
        where: {
          businessId,
          status: "COMPLETED",
          paidAt: {
            gte: periodStart,
            lt: periodEnd,
          },
        },
      }),

      prisma.customer.count({
        where: {
          businessId,
          isActive: true,
        },
      }),

      prisma.product.count({
        where: {
          businessId,
          isActive: true,
        },
      }),

      prisma.product.findMany({
        where: {
          businessId,
          isActive: true,
          stockQuantity: {
            lte: prisma.product.fields.lowStockLevel,
          },
        },
        orderBy: {
          stockQuantity: "asc",
        },
        take: 10,
      }),

      prisma.sale.findMany({
        where: {
          businessId,
          status: "COMPLETED",
          soldAt: {
            gte: previousPeriodStart,
            lt: previousPeriodEnd,
          },
        },
        include: {
          items: true,
        },
      }),

      prisma.expense.findMany({
        where: {
          businessId,
          status: "RECORDED",
          expenseDate: {
            gte: previousPeriodStart,
            lt: previousPeriodEnd,
          },
        },
      }),

      prisma.payment.findMany({
        where: {
          businessId,
          status: "COMPLETED",
          paidAt: {
            gte: previousPeriodStart,
            lt: previousPeriodEnd,
          },
        },
      }),
    ]);

  let salesTotal = money(0);
  let grossProfit = money(0);
  let totalItemsSold = money(0);

  for (const sale of sales) {
    salesTotal = salesTotal.add(sale.total);

    for (const item of sale.items) {
      const revenue = item.unitPrice.mul(item.quantity);
      const cost = item.buyingPrice.mul(item.quantity);

      grossProfit = grossProfit.add(revenue.sub(cost));
      totalItemsSold = totalItemsSold.add(item.quantity);
    }
  }

  const expensesTotal = expenses.reduce(
    (total, expense) => total.add(expense.amount),
    money(0),
  );

  const paymentsCollected = payments.reduce(
    (total, payment) => total.add(payment.amount),
    money(0),
  );

  const previousSalesTotal = previousSales.reduce(
    (total, sale) => total.add(sale.total),
    money(0),
  );

  const previousGrossProfit = previousSales.reduce(
    (total, sale) =>
      total.add(
        sale.items.reduce(
          (saleTotal, item) =>
            saleTotal.add(
              item.unitPrice
                .sub(item.buyingPrice)
                .mul(item.quantity),
            ),
          money(0),
        ),
      ),
    money(0),
  );

  const previousExpensesTotal = previousExpenses.reduce(
    (total, expense) => total.add(expense.amount),
    money(0),
  );

  const previousPaymentsCollected = previousPayments.reduce(
    (total, payment) => total.add(payment.amount),
    money(0),
  );

  const percentageChange = (
    current: Prisma.Decimal,
    previous: Prisma.Decimal,
  ) => {
    if (previous.isZero()) {
      return null;
    }

    return current
      .sub(previous)
      .div(previous)
      .mul(100);
  };

  const comparison = {
    salesTotal: {
      current: salesTotal,
      previous: previousSalesTotal,
      percentageChange: percentageChange(
        salesTotal,
        previousSalesTotal,
      ),
    },

    grossProfit: {
      current: grossProfit,
      previous: previousGrossProfit,
      percentageChange: percentageChange(
        grossProfit,
        previousGrossProfit,
      ),
    },

    expensesTotal: {
      current: expensesTotal,
      previous: previousExpensesTotal,
      percentageChange: percentageChange(
        expensesTotal,
        previousExpensesTotal,
      ),
    },

    paymentsCollected: {
      current: paymentsCollected,
      previous: previousPaymentsCollected,
      percentageChange: percentageChange(
        paymentsCollected,
        previousPaymentsCollected,
      ),
    },
  };

  const topProductsMap = new Map<
    string,
    {
      productId: string;
      name: string;
      sku: string;
      quantitySold: Prisma.Decimal;
      revenue: Prisma.Decimal;
      grossProfit: Prisma.Decimal;
    }
  >();

  for (const sale of sales) {
    for (const item of sale.items) {
      const existing = topProductsMap.get(item.productId);

      const revenue = item.unitPrice.mul(item.quantity);
      const cost = item.buyingPrice.mul(item.quantity);
      const profit = revenue.sub(cost);

      if (existing) {
        existing.quantitySold = existing.quantitySold.add(item.quantity);
        existing.revenue = existing.revenue.add(revenue);
        existing.grossProfit = existing.grossProfit.add(profit);
      } else {
        topProductsMap.set(item.productId, {
          productId: item.productId,
          name: item.productId,
          sku: item.productId,
          quantitySold: item.quantity,
          revenue,
          grossProfit: profit,
        });
      }
    }
  }

  const productIds = Array.from(topProductsMap.keys());

  const soldProducts =
    productIds.length > 0
      ? await prisma.product.findMany({
          where: {
            businessId,
            id: {
              in: productIds,
            },
          },
          select: {
            id: true,
            name: true,
            sku: true,
          },
        })
      : [];

  const productDetails = new Map(
    soldProducts.map((product) => [product.id, product]),
  );

  const topProducts = Array.from(topProductsMap.values())
    .map((item) => ({
      ...item,
      name: productDetails.get(item.productId)?.name ?? item.name,
      sku: productDetails.get(item.productId)?.sku ?? item.sku,
    }))
    .sort((a, b) => b.quantitySold.comparedTo(a.quantitySold))
    .slice(0, 10);

  const salesTrendMap = new Map<
    string,
    {
      date: string;
      salesCount: number;
      revenue: Prisma.Decimal;
      grossProfit: Prisma.Decimal;
    }
  >();

  for (const sale of sales) {
    const date = sale.soldAt.toISOString().slice(0, 10);

    const existing = salesTrendMap.get(date);

    if (existing) {
      existing.salesCount += 1;
      existing.revenue = existing.revenue.add(sale.total);

      const saleProfit = sale.items.reduce(
        (total, item) =>
          total.add(
            item.unitPrice
              .sub(item.buyingPrice)
              .mul(item.quantity),
          ),
        money(0),
      );

      existing.grossProfit = existing.grossProfit.add(saleProfit);
    } else {
      const saleProfit = sale.items.reduce(
        (total, item) =>
          total.add(
            item.unitPrice
              .sub(item.buyingPrice)
              .mul(item.quantity),
          ),
        money(0),
      );

      salesTrendMap.set(date, {
        date,
        salesCount: 1,
        revenue: sale.total,
        grossProfit: saleProfit,
      });
    }
  }

  const salesTrend = Array.from(salesTrendMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  const totalOutstanding = await prisma.customer.aggregate({
    where: {
      businessId,
      isActive: true,
    },
    _sum: {
      outstanding: true,
    },
  });

  const inventoryValue = await prisma.product.findMany({
    where: {
      businessId,
      isActive: true,
    },
    select: {
      stockQuantity: true,
      buyingPrice: true,
      sellingPrice: true,
    },
  });

  const stockCostValue = inventoryValue.reduce(
    (total, product) =>
      total.add(product.stockQuantity.mul(product.buyingPrice)),
    money(0),
  );

  const stockRetailValue = inventoryValue.reduce(
    (total, product) =>
      total.add(product.stockQuantity.mul(product.sellingPrice)),
    money(0),
  );

  return {
    period: {
      start: periodStart,
      end: periodEnd,
    },

    sales: {
      count: sales.length,
      total: salesTotal,
      itemsSold: totalItemsSold,
      grossProfit,
    },

    expenses: {
      count: expenses.length,
      total: expensesTotal,
    },

    financial: {
      paymentsCollected,
      customerOutstanding: totalOutstanding._sum.outstanding ?? money(0),
      netOperatingResult: grossProfit.sub(expensesTotal),
    },

    comparison,

    inventory: {
      activeProducts: products,
      lowStockCount: lowStockProducts.length,
      lowStockProducts,
      stockCostValue,
      stockRetailValue,
      potentialStockMargin: stockRetailValue.sub(stockCostValue),
    },

    topProducts,

    salesTrend,

    customers: {
      active: customers,
    },
  };
}
