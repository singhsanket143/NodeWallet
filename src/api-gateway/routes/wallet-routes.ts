import { Router } from "express";
import { WalletController } from "../../wallet-service/controllers/wallet-controller";

const router = Router();
const walletController = new WalletController();

router.post("/", walletController.createWallet.bind(walletController));
router.get("/:userId", walletController.getWallet.bind(walletController));
router.post("/:userId/add-money", walletController.addMoney.bind(walletController));

export default router;