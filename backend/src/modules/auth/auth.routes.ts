import { Router } from "express";
import {
  login,
  register,
} from "./auth.controller";
import {
  authenticate,
  AuthenticatedRequest,
} from "../../middleware/auth.middleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);

router.get("/me", authenticate, (req: AuthenticatedRequest, res) => {
  res.status(200).json({
    success: true,
    message: "Authenticated request successful",
    data: {
      userId: req.user?.userId,
      businessId: req.user?.businessId,
      role: req.user?.role,
    },
  });
});

export default router;
