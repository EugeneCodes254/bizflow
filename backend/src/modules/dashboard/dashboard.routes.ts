import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { getSummary } from "./dashboard.controller";

const router = Router();

router.get("/summary", authenticate, getSummary);

export default router;
