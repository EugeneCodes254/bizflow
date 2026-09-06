import { Request, Response } from "express";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { z } from "zod";
import {
  createCustomer,
  deactivateCustomer,
  getCustomerById,
  getCustomers,
  updateCustomer,
} from "./customer.service";

const createCustomerSchema = z.object({
  name: z.string().min(1, "Customer name is required"),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  creditLimit: z.number().nonnegative().optional(),
});

const updateCustomerSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  creditLimit: z.number().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

function getBusinessId(req: AuthenticatedRequest) {
  return req.user?.businessId;
}

export async function create(req: AuthenticatedRequest, res: Response) {
  try {
    const businessId = getBusinessId(req);

    if (!businessId) {
      return res.status(401).json({
        success: false,
        message: "Business context is missing",
      });
    }

    const result = createCustomerSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer data",
        errors: result.error.flatten(),
      });
    }

    const customer = await createCustomer(businessId, result.data);

    return res.status(201).json({
      success: true,
      message: "Customer created successfully",
      data: customer,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create customer";

    if (message.includes("already exists")) {
      return res.status(409).json({
        success: false,
        message,
      });
    }

    return res.status(500).json({
      success: false,
      message,
    });
  }
}

export async function list(req: AuthenticatedRequest, res: Response) {
  try {
    const businessId = getBusinessId(req);

    if (!businessId) {
      return res.status(401).json({
        success: false,
        message: "Business context is missing",
      });
    }

    const search =
      typeof req.query.search === "string"
        ? req.query.search
        : undefined;

    const customers = await getCustomers(businessId, search);

    return res.status(200).json({
      success: true,
      message: "Customers retrieved successfully",
      data: customers,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to retrieve customers";

    return res.status(500).json({
      success: false,
      message,
    });
  }
}

export async function getOne(req: AuthenticatedRequest, res: Response) {
  try {
    const businessId = getBusinessId(req);
    const customerId =
      typeof req.params.id === "string" ? req.params.id : undefined;

    if (!businessId) {
      return res.status(401).json({
        success: false,
        message: "Business context is missing",
      });
    }

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: "Customer ID is required",
      });
    }

    const customer = await getCustomerById(
      businessId,
      customerId,
    );

    return res.status(200).json({
      success: true,
      message: "Customer retrieved successfully",
      data: customer,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to retrieve customer";

    if (message === "Customer not found") {
      return res.status(404).json({
        success: false,
        message,
      });
    }

    return res.status(500).json({
      success: false,
      message,
    });
  }
}

export async function update(req: AuthenticatedRequest, res: Response) {
  try {
    const businessId = getBusinessId(req);
    const customerId =
      typeof req.params.id === "string" ? req.params.id : undefined;

    if (!businessId) {
      return res.status(401).json({
        success: false,
        message: "Business context is missing",
      });
    }

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: "Customer ID is required",
      });
    }

    const result = updateCustomerSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer data",
        errors: result.error.flatten(),
      });
    }

    const customer = await updateCustomer(
      businessId,
      customerId,
      result.data,
    );

    return res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      data: customer,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update customer";

    if (message === "Customer not found") {
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

    return res.status(500).json({
      success: false,
      message,
    });
  }
}

export async function remove(req: AuthenticatedRequest, res: Response) {
  try {
    const businessId = getBusinessId(req);
    const customerId =
      typeof req.params.id === "string" ? req.params.id : undefined;

    if (!businessId) {
      return res.status(401).json({
        success: false,
        message: "Business context is missing",
      });
    }

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: "Customer ID is required",
      });
    }

    const customer = await deactivateCustomer(
      businessId,
      customerId,
    );

    return res.status(200).json({
      success: true,
      message: "Customer deactivated successfully",
      data: customer,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to deactivate customer";

    if (message === "Customer not found") {
      return res.status(404).json({
        success: false,
        message,
      });
    }

    return res.status(500).json({
      success: false,
      message,
    });
  }
}
