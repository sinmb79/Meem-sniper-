import type { FeeQuote, TradeType } from "../types";
import { AppConfig } from "../types";
import { PremiumManager } from "./premiumManager";
import { ReferralManager } from "./referralManager";

const tradeTypeToConfigKey: Record<TradeType, keyof AppConfig["fees"]> = {
  manual_buy: "manualBuyRate",
  manual_sell: "manualSellRate",
  auto_snipe: "autoSnipeRate",
  auto_tp_sl: "autoTpSlRate",
  rug_emergency: "rugEmergencyRate"
};

export class FeeCalculator {
  constructor(
    private readonly config: AppConfig,
    private readonly premiumManager: PremiumManager,
    private readonly referralManager: ReferralManager
  ) {}

  calculate(userId: string, tradeType: TradeType, amountSol: number): FeeQuote {
    const isPro = this.premiumManager.isPro(userId);
    const hasReferral = this.referralManager.hasReferrer(userId);

    let feeRate = this.config.fees[tradeTypeToConfigKey[tradeType]] as number;

    if (isPro) {
      feeRate = this.config.fees.proRate;
    } else if (hasReferral && tradeType !== "rug_emergency") {
      feeRate = Math.max(0, feeRate - this.config.fees.referralDiscount);
    }

    const feeSol = amountSol * feeRate;
    return {
      feeSol,
      netAmountSol: Math.max(0, amountSol - feeSol),
      feeRate,
      isPro,
      hasReferral
    };
  }
}
