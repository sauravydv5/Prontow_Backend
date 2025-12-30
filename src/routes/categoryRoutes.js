import express from "express";
import {
  getCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  deleteSubcategory
} from "../controllers/categoryController.js";

import protect, { adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/",getCategories);
router.post("/",protect,adminOnly, addCategory);
router.put("/:id",protect,adminOnly, updateCategory);
router.delete("/:id",protect,adminOnly, deleteCategory);
router.delete("/subcategory/:id",protect,adminOnly, deleteSubcategory);

export default router;
