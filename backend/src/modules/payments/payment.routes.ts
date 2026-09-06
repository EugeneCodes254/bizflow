import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import {
  create,
  getOne,
  list,
} from "./payment.controller";

const router = Router();

router.use(authenticate);

router.post("/", create);
router.get("/", list);
router.get("/:id", getOne);

export default router;
