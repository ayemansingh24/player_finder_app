import { Router } from "express";
import * as teamController from "../controllers/team.controller.js";
import * as membershipController from "../controllers/teamMembership.controller.js";
import * as recruitmentController from "../controllers/recruitment.controller.js";
import { verifyJWT } from "../../../middlewares/auth.middleware.js";

const router = Router();

// All Team routes require JWT authentication
router.use(verifyJWT);

// Team CRUD & List
router.post("/", teamController.createTeam);
router.get("/my-teams", teamController.getMyTeams);
router.get("/:teamId", teamController.getTeamById);
router.patch("/:teamId", teamController.updateTeam);
router.post("/:teamId/convert-to-permanent", teamController.convertToPermanent);

// Lineup Eligibility
router.get("/:teamId/eligibility", teamController.checkTeamEligibility);
router.post("/:teamId/eligibility", teamController.checkTeamEligibility);

// Members
router.get("/:teamId/members", membershipController.getTeamMembers);
router.delete("/:teamId/members/:userId", membershipController.removeMember);
router.post("/:teamId/transfer-captain", membershipController.transferCaptain);

// Recruitment
router.post("/:teamId/recruitment", recruitmentController.createRecruitment);
router.get("/:teamId/recruitment", recruitmentController.getTeamRecruitments);
router.patch("/:teamId/recruitment/:requestId", recruitmentController.updateRecruitment);

export default router;
