import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./modules/auth/auth.routes";
import productRoutes from "./modules/products/product.routes";
import customerRoutes from "./modules/customers/customer.routes";
import supplierRoutes from "./modules/suppliers/supplier.routes";
import saleRoutes from "./modules/sales/sale.routes";
import invoiceRoutes from "./modules/invoices/invoice.routes";
import paymentRoutes from "./modules/payments/payment.routes";
import expenseRoutes from "./modules/expenses/expense.routes";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "BizFlow API is running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.listen(PORT, () => {
  console.log(`🚀 BizFlow API running on http://localhost:${PORT}`);
});
