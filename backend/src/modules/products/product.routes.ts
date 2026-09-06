import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import {
  create,
  getOne,
  list,
  remove,
  update,
} from "./product.controller";

const router = Router();

router.use(authenticate);

router.post("/", create);
router.get("/", list);
router.get("/:id", getOne);
router.patch("/:id", update);
router.delete("/:id", remove);

export default router;
