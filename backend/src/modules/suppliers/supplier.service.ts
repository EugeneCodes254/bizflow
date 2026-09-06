import { prisma } from "../../lib/prisma";

interface CreateSupplierInput {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}

interface UpdateSupplierInput {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  isActive?: boolean;
}

export async function createSupplier(
  businessId: string,
  input: CreateSupplierInput,
) {
  const phone = input.phone?.trim() || undefined;

  if (phone) {
    const existingSupplier = await prisma.supplier.findFirst({
      where: {
        businessId,
        phone,
      },
    });

    if (existingSupplier) {
      throw new Error("A supplier with this phone number already exists");
    }
  }

  return prisma.supplier.create({
    data: {
      businessId,
      name: input.name.trim(),
      phone,
      email: input.email?.trim().toLowerCase() || undefined,
      address: input.address?.trim() || undefined,
    },
  });
}

export async function getSuppliers(
  businessId: string,
  search?: string,
) {
  const normalizedSearch = search?.trim();

  return prisma.supplier.findMany({
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

export async function getSupplierById(
  businessId: string,
  supplierId: string,
) {
  const supplier = await prisma.supplier.findFirst({
    where: {
      id: supplierId,
      businessId,
    },
  });

  if (!supplier) {
    throw new Error("Supplier not found");
  }

  return supplier;
}

export async function updateSupplier(
  businessId: string,
  supplierId: string,
  input: UpdateSupplierInput,
) {
  const existingSupplier = await prisma.supplier.findFirst({
    where: {
      id: supplierId,
      businessId,
    },
  });

  if (!existingSupplier) {
    throw new Error("Supplier not found");
  }

  const phone = input.phone?.trim();

  if (phone && phone !== existingSupplier.phone) {
    const duplicatePhone = await prisma.supplier.findFirst({
      where: {
        businessId,
        phone,
        NOT: {
          id: supplierId,
        },
      },
    });

    if (duplicatePhone) {
      throw new Error("A supplier with this phone number already exists");
    }
  }

  return prisma.supplier.update({
    where: {
      id: supplierId,
    },
    data: {
      name: input.name?.trim(),
      phone: phone || undefined,
      email: input.email?.trim().toLowerCase() || undefined,
      address: input.address?.trim() || undefined,
      isActive: input.isActive,
    },
  });
}

export async function deactivateSupplier(
  businessId: string,
  supplierId: string,
) {
  const existingSupplier = await prisma.supplier.findFirst({
    where: {
      id: supplierId,
      businessId,
    },
  });

  if (!existingSupplier) {
    throw new Error("Supplier not found");
  }

  return prisma.supplier.update({
    where: {
      id: supplierId,
    },
    data: {
      isActive: false,
    },
  });
}
