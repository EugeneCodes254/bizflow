import { prisma } from "../../lib/prisma";

interface CreateCustomerInput {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  creditLimit?: number;
}

interface UpdateCustomerInput {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  creditLimit?: number;
  isActive?: boolean;
}

export async function createCustomer(
  businessId: string,
  input: CreateCustomerInput,
) {
  const phone = input.phone?.trim() || undefined;

  if (phone) {
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        businessId,
        phone,
      },
    });

    if (existingCustomer) {
      throw new Error("A customer with this phone number already exists");
    }
  }

  return prisma.customer.create({
    data: {
      businessId,
      name: input.name.trim(),
      phone,
      email: input.email?.trim().toLowerCase() || undefined,
      address: input.address?.trim() || undefined,
      creditLimit: input.creditLimit ?? 0,
    },
  });
}

export async function getCustomers(
  businessId: string,
  search?: string,
) {
  const normalizedSearch = search?.trim();

  return prisma.customer.findMany({
    where: {
      businessId,
      ...(normalizedSearch
        ? {
            OR: [
              {
                name: {
                  contains: normalizedSearch,
                  mode: "insensitive",
                },
              },
              {
                phone: {
                  contains: normalizedSearch,
                  mode: "insensitive",
                },
              },
              {
                email: {
                  contains: normalizedSearch,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getCustomerById(
  businessId: string,
  customerId: string,
) {
  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      businessId,
    },
  });

  if (!customer) {
    throw new Error("Customer not found");
  }

  return customer;
}

export async function updateCustomer(
  businessId: string,
  customerId: string,
  input: UpdateCustomerInput,
) {
  const existingCustomer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      businessId,
    },
  });

  if (!existingCustomer) {
    throw new Error("Customer not found");
  }

  const phone = input.phone?.trim();

  if (phone && phone !== existingCustomer.phone) {
    const duplicatePhone = await prisma.customer.findFirst({
      where: {
        businessId,
        phone,
        NOT: {
          id: customerId,
        },
      },
    });

    if (duplicatePhone) {
      throw new Error("A customer with this phone number already exists");
    }
  }

  return prisma.customer.update({
    where: {
      id: customerId,
    },
    data: {
      name: input.name?.trim(),
      phone: phone || undefined,
      email: input.email?.trim().toLowerCase() || undefined,
      address: input.address?.trim() || undefined,
      creditLimit: input.creditLimit,
      isActive: input.isActive,
    },
  });
}

export async function deactivateCustomer(
  businessId: string,
  customerId: string,
) {
  const existingCustomer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      businessId,
    },
  });

  if (!existingCustomer) {
    throw new Error("Customer not found");
  }

  return prisma.customer.update({
    where: {
      id: customerId,
    },
    data: {
      isActive: false,
    },
  });
}
