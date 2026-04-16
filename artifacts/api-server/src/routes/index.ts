import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import ipaRouter from "./ipa";
import practiceRouter from "./practice";
import assessmentRouter from "./assessment";
import dashboardRouter from "./dashboard";
import pronunciationRouter from "./pronunciation";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(ipaRouter);
router.use(practiceRouter);
router.use(assessmentRouter);
router.use(dashboardRouter);
router.use(pronunciationRouter);

export default router;
