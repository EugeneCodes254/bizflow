import { Response } from "express";
import {
  AuthenticatedRequest,
} from "../../middleware/auth.middleware";
import { getDashboardSummary } from "./dashboard.service";

export async function getSummary(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const businessId = req.user?.businessId;

    if (!businessId) {
      return res.status(401).json({
        success: false,
        message: "Business context is missing",
      });
    }

    const startDate = req.query.startDate
      ? new Date(String(req.query.startDate))
      : undefined;

    const endDate = req.query.endDate
      ? new Date(String(req.query.endDate))
      : undefined;

    if (
      (startDate && Number.isNaN(startDate.getTime())) ||
      (endDate && Number.isNaN(endDate.getTime()))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format",
      });
    }

    const summary = await getDashboardSummary(
      businessId,
      startDate,
      endDate,
    );

    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load dashboard summary",
    });
  }
}
