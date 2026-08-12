import { Router, type IRouter } from "express";
import healthRouter from "./health";
import cvRankingRouter from "./cv-ranking"; // <--- Added this line

const router: IRouter = Router();

router.use(healthRouter);
router.use(cvRankingRouter); // <--- Added this line

export default router;
