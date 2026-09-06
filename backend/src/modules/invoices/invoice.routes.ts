import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { create, getOne, list, updateStatus } from "./invoice.controller";

const router = Router();

router.use(authenticate);

router.post("/", create);
router.get("/", list);
router.get("/:id", getOne);
router.patch("/:id/status", updateStatus);

export default router;
