import express from "express";
import protect, { adminOnly } from "../middleware/authMiddleware.js";
import {
  getAllCustomers,
  updateCustomerStatus,
  deleteCustomer,
  addCustomer,
  getCustomersByRating,
  getCustomersByDateRange,
} from "../controllers/customerController.js";
import { addCustomerValidation } from "../validators/user.validation.js";
import requestValidator from "../middleware/requestValidator.js";

const router = express.Router();

router.post("/", protect, adminOnly, addCustomerValidation, requestValidator, addCustomer);
router.get("/date-range", protect, adminOnly, getCustomersByDateRange);
router.get("/rating", protect, adminOnly, getCustomersByRating);
router.get("/", protect, adminOnly, getAllCustomers);
router.patch("/:customerId/status", protect, adminOnly, updateCustomerStatus);
router.delete("/:customerId", protect, adminOnly, deleteCustomer);

export default router;

