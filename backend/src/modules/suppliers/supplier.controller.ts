import { Request, Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import {
  createSupplier,
  deactivateSupplier,
  getSupplierById,
  getSuppliers,
  updateSupplier,
} from "./supplier.service";

const createSupplierSchema = z.object({
  name: z.string().min(1, "Supplier name is required"),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
});

const updateSupplierSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  isActive: z.boolean().optional(),
});

function getBusinessId(req: AuthenticatedRequest) {
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

    const parsed = createSupplierSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid supplier data",
        errors: parsed.error.flatten(),
      });
    }

    const supplier = await createSupplier(businessId, parsed.data);

    return res.status(201).json({
      success: true,
      message: "Supplier created successfully",
      data: supplier,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create supplier";

    if (message.includes("already exists")) {
      return res.status(409).json({
        success: false,
        message,
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to create supplier",
    });
  }
}

export async function list(
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

    const search =
      typeof req.query.search === "string"
        ? req.query.search
        : undefined;

    const suppliers = await getSuppliers(businessId, search);

    return res.status(200).json({
      success: true,
      message: "Suppliers retrieved successfully",
      data: suppliers,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve suppliers",
    });
  }
}

export async function getOne(
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

    const supplierId =
      typeof req.params.id === "string"
        ? req.params.id
        : undefined;

    if (!supplierId) {
      return res.status(400).json({
        success: false,
        message: "Supplier ID is required",
      });
    }

    const supplier = await getSupplierById(
      businessId,
      supplierId,
    );

    return res.status(200).json({
      success: true,
      message: "Supplier retrieved successfully",
      data: supplier,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to retrieve supplier";

    if (message === "Supplier not found") {
      return res.status(404).json({
        success: false,
        message,
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve supplier",
    });
  }
}

export async function update(
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

    const supplierId =
      typeof req.params.id === "string"
        ? req.params.id
        : undefined;

    if (!supplierId) {
      return res.status(400).json({
        success: false,
        message: "Supplier ID is required",
      });
    }

    const parsed = updateSupplierSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid supplier data",
        errors: parsed.error.flatten(),
      });
    }

    const supplier = await updateSupplier(
      businessId,
      supplierId,
      parsed.data,
    );

    return res.status(200).json({
      success: true,
      message: "Supplier updated successfully",
      data: supplier,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update supplier";

    if (message === "Supplier not found") {
      return res.status(404).json({
        success: false,
        message,
      });
    }

    if (message.includes("already exists")) {
      return res.status(409).json({
        success: false,
        message,
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to update supplier",
    });
  }
}

export async function remove(
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

    const supplierId =
      typeof req.params.id === "string"
        ? req.params.id
        : undefined;

    if (!supplierId) {
      return res.status(400).json({
        success: false,
        message: "Supplier ID is required",
      });
    }

    await deactivateSupplier(businessId, supplierId);

    return res.status(200).json({
      success: true,
      message: "Supplier deactivated successfully",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to deactivate supplier";

    if (message === "Supplier not found") {
      return res.status(404).json({
        success: false,
        message,
      });
    }

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to deactivate supplier",
    });
  }
}
