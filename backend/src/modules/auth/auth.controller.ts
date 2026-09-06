import { Request, Response } from "express";
import { z } from "zod";
import {
  loginUser,
  registerBusiness,
} from "./auth.service";

const registerSchema = z.object({
  businessName: z.string().trim().min(2).max(100),
  firstName: z.string().trim().min(2).max(50),
  lastName: z.string().trim().max(50).optional(),
  email: z.string().trim().email(),
  password: z.string().min(8).max(100),
  phone: z.string().trim().max(30).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(100),
});

export async function register(req: Request, res: Response) {
  try {
    const input = registerSchema.parse(req.body);
    const result = await registerBusiness(input);

    res.status(201).json({
      success: true,
      message: "Business account created successfully",
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: "Invalid registration data",
        errors: error.issues,
      });
      return;
    }

    if (
      error instanceof Error &&
      error.message === "An account with this email already exists"
    ) {
      res.status(409).json({
        success: false,
        message: error.message,
      });
      return;
    }

    console.error("Registration error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to create business account",
    });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const input = loginSchema.parse(req.body);
    const result = await loginUser(input);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: "Invalid login data",
        errors: error.issues,
      });
      return;
    }

    if (
      error instanceof Error &&
      error.message === "Invalid email or password"
    ) {
      res.status(401).json({
        success: false,
        message: error.message,
      });
      return;
    }

    console.error("Login error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to log in",
    });
  }
}
