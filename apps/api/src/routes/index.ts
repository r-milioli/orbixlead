import { Router } from "express";
import authRoutes from "./auth";
import adminRoutes from "./admin";
import collaboratorsRoutes from "./collaborators";
import stagesRoutes from "./stages";
import leadsRoutes from "./leads";
import schedulesRoutes from "./schedules";
import templatesRoutes from "./templates";
import capturesRoutes from "./captures";
import goalsRoutes from "./goals";
import notificationsRoutes from "./notifications";
import settingsRoutes from "./settings";
import dashboardRoutes from "./dashboard";

const router = Router();

router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/collaborators", collaboratorsRoutes);
router.use("/stages", stagesRoutes);
router.use("/leads", leadsRoutes);
router.use("/schedules", schedulesRoutes);
router.use("/templates", templatesRoutes);
router.use("/captures", capturesRoutes);
router.use("/goals", goalsRoutes);
router.use("/notifications", notificationsRoutes);
router.use("/settings", settingsRoutes);
router.use("/dashboard", dashboardRoutes);

router.get("/health", (_req, res) => {
  res.json({ ok: true, service: "@orbixlead/api" });
});

export default router;
