import { Router, type IRouter } from "express";
import healthRouter from "./health";
import keysRouter from "./keys";
import adminRouter from "./admin";
import proxyRouter from "./proxy";

const router: IRouter = Router();

router.use(healthRouter);
router.use(proxyRouter);
router.use(keysRouter);
router.use(adminRouter);

export default router;
