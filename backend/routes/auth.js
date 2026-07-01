import express from "express";
import {
  register,
  login,
  me,
  updateProfile
} from "../controllers/authController.js";   // ✅ .js

import { protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, me);       // ✅ GET, not POST (optional, but consistent)
router.put("/profile", protect, updateProfile); // ✅ PUT for updates

export default router;