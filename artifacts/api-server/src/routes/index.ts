import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import companyRouter from "./company";
import usersRouter from "./users";
import suppliersRouter from "./suppliers";
import productsRouter from "./products";
import purchaseOrdersRouter from "./purchase_orders";
import supplierProductsRouter from "./supplier_products";
import customersRouter from "./customers";
import salesRouter from "./sales";
import tasksRouter from "./tasks";
import dashboardRouter from "./dashboard";
import auditLogsRouter from "./audit_logs";
import reportsRouter from "./reports";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/company", companyRouter);
router.use("/users", usersRouter);
router.use("/suppliers", suppliersRouter);
router.use("/products", productsRouter);
router.use("/purchase-orders", purchaseOrdersRouter);
router.use("/supplier-products", supplierProductsRouter);
router.use("/customers", customersRouter);
router.use("/sales", salesRouter);
router.use("/tasks", tasksRouter);
router.use("/sales-targets", tasksRouter);
router.use("/dashboard", dashboardRouter);
router.use("/audit-logs", auditLogsRouter);
router.use("/reports", reportsRouter);

export default router;
