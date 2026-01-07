import { SeededRNG, clamp } from '../lib/utils';
import type { Dataset, Merchant, Plan, PriceChangeEvent, PlanInterval } from './types';

const VERTICAL = "Streaming Service" as const;

const MERCHANT_NAMES = [
  "StreamFlix",
  "VideoHub",
  "CinemaNow",
  "WatchMax",
  "ScreenTime",
  "MediaStream",
  "EntertainmentPlus",
];

const PLAN_NAME_PREFIXES = ["Basic", "Standard", "Premium", "Pro", "Ultra", "Family"];
const PLAN_NAME_SUFFIXES = ["Plan", "Tier", "Package"];

const PRICE_CHANGE_PCTS = [-0.10, 0.05, 0.10, 0.15, 0.25];
const PRICE_CHANGE_WEIGHTS = [0.05, 0.15, 0.35, 0.35, 0.10]; // Weighted toward +10% and +15%

const EVENT_NOTES = [
  "Grandfathered cohort excluded",
  "Seasonal promo period",
  "Competitive response",
  "Feature expansion included",
  "Limited time offer",
  "Annual plan discount",
  "Regional pricing test",
  undefined,
  undefined,
  undefined, // More undefined for less notes
];

export function generateDataset(seed: number): Dataset {
  const rng = new SeededRNG(seed);
  const merchants: Merchant[] = [];
  const plans: Plan[] = [];
  const events: PriceChangeEvent[] = [];

  // Generate merchants
  const merchantIds: string[] = [];
  
  // Test merchant first
  const testMerchant: Merchant = {
    id: "m_test",
    name: "Test Merchant",
    vertical: VERTICAL,
  };
  merchants.push(testMerchant);
  merchantIds.push("m_test");

  // Generate 6 more merchants
  const availableNames = [...MERCHANT_NAMES];
  for (let i = 1; i <= 6; i++) {
    const name = rng.choice(availableNames);
    availableNames.splice(availableNames.indexOf(name), 1);
    
    const merchant: Merchant = {
      id: `m_${i}`,
      name,
      vertical: VERTICAL,
    };
    merchants.push(merchant);
    merchantIds.push(`m_${i}`);
  }

  // Generate plans for each merchant
  const now = new Date();
  for (const merchantId of merchantIds) {
    const numPlans = rng.int(3, 6);
    const intervals: PlanInterval[] = ["monthly", "annual"];
    
    for (let p = 0; p < numPlans; p++) {
      const interval = rng.choice(intervals);
      const prefix = rng.choice(PLAN_NAME_PREFIXES);
      const suffix = rng.choice(PLAN_NAME_SUFFIXES);
      const name = `${prefix} ${suffix}`;
      
      // Monthly price range: $7.99 - $29.99
      const currentPriceMonthly = Math.round((rng.float(7.99, 29.99)) * 100) / 100;
      
      // Active subs: 200 - 12000
      const activeSubs = rng.int(200, 12000);
      
      // Baseline churn 90d: 2% - 10%
      const baselineChurn90d = clamp(rng.float(0.02, 0.10), 0, 0.35);
      
      // Addon ARPU: $0 - $5/month
      const arpuAddonsMonthly = Math.round(rng.float(0, 5) * 100) / 100;
      
      // Created date: 6-24 months ago
      const monthsAgo = rng.int(6, 24);
      const createdAt = new Date(now);
      createdAt.setMonth(createdAt.getMonth() - monthsAgo);
      
      const plan: Plan = {
        id: `${merchantId}_plan_${p + 1}`,
        merchantId,
        name,
        interval,
        currentPriceMonthly,
        activeSubs,
        baselineChurn90d,
        arpuAddonsMonthly,
        createdAt,
      };
      plans.push(plan);
    }
  }

  // Generate price change events
  for (const merchant of merchants) {
    const merchantPlans = plans.filter(p => p.merchantId === merchant.id);
    const numEvents = rng.int(5, 20);
    
    for (let e = 0; e < numEvents; e++) {
      const plan = rng.choice(merchantPlans);
      
      // Pick price change % (weighted)
      const rand = rng.next();
      let cumWeight = 0;
      let pctChange = PRICE_CHANGE_PCTS[0];
      for (let i = 0; i < PRICE_CHANGE_PCTS.length; i++) {
        cumWeight += PRICE_CHANGE_WEIGHTS[i];
        if (rand <= cumWeight) {
          pctChange = PRICE_CHANGE_PCTS[i];
          break;
        }
      }
      
      const oldPriceMonthly = plan.currentPriceMonthly;
      const newPriceMonthly = Math.round((oldPriceMonthly * (1 + pctChange)) * 100) / 100;
      
      // Event date: between plan creation and now
      const daysSinceCreation = Math.floor((now.getTime() - plan.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const daysAgo = rng.int(0, Math.max(0, daysSinceCreation - 30)); // At least 30 days ago
      const effectiveDate = new Date(now);
      effectiveDate.setDate(effectiveDate.getDate() - daysAgo);
      
      // Control churn: near baseline with noise
      const controlNoise = rng.float(-0.02, 0.02);
      const churn90dControl = clamp(plan.baselineChurn90d + controlNoise, 0, 0.35);
      
      // Treatment churn: control + lift
      // Lift increases with price increase magnitude, decreases with price cuts
      let churnLift = 0;
      if (pctChange > 0) {
        // Price increase: lift = base * (pctChange / 0.10)
        // So +10% -> base lift, +20% -> 2x base lift
        const baseLift = 0.012; // 1.2pp per 10% increase
        churnLift = baseLift * (pctChange / 0.10);
        churnLift = clamp(churnLift, 0, 0.15); // Cap at 15pp
      } else {
        // Price cut: smaller negative lift (reduces churn)
        const baseLift = 0.006; // 0.6pp per 10% decrease
        churnLift = baseLift * (pctChange / 0.10); // Negative
        churnLift = clamp(churnLift, -0.10, 0); // Cap reduction at 10pp
      }
      
      const churn90dTreatment = clamp(churn90dControl + churnLift, 0, 0.35);
      
      // Random note
      const note = rng.choice(EVENT_NOTES);
      
      const event: PriceChangeEvent = {
        id: `${merchant.id}_event_${e + 1}`,
        merchantId: merchant.id,
        planId: plan.id,
        effectiveDate,
        oldPriceMonthly,
        newPriceMonthly,
        pctChange,
        churn90dTreatment,
        churn90dControl,
        notes: note,
      };
      events.push(event);
    }
  }

  // Sort events by date (newest first)
  events.sort((a, b) => b.effectiveDate.getTime() - a.effectiveDate.getTime());

  return {
    merchants,
    plans,
    events,
  };
}

