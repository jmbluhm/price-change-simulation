import { SeededRNG, clamp } from '../lib/utils';
import type { Dataset, Merchant, Plan, PriceChangeEvent, PlanInterval, CancellationEvent, PaymentFailureEvent, PauseEvent, InterventionType, IncentiveStrength } from './types';

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
  const cancellationEvents: CancellationEvent[] = [];
  const paymentFailureEvents: PaymentFailureEvent[] = [];
  const pauseEvents: PauseEvent[] = [];

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
      
      // Churn simulation baseline rates
      const baselineCancelRate90d = clamp(rng.float(0.02, 0.08), 0, 0.15);
      const paymentFailureRate90d = clamp(rng.float(0.01, 0.06), 0, 0.10);
      const baselineDunningRecoveryRate = clamp(rng.float(0.30, 0.65), 0.20, 0.80);
      const baselinePauseAdoptionRate = clamp(rng.float(0.02, 0.15), 0, 0.25);
      
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
        baselineCancelRate90d,
        paymentFailureRate90d,
        baselineDunningRecoveryRate,
        baselinePauseAdoptionRate,
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

  // Generate churn-related events for each plan
  for (const plan of plans) {
    // Generate cancellation events: 200-800 per plan
    const numCancellationEvents = rng.int(200, 800);
    for (let i = 0; i < numCancellationEvents; i++) {
      const interventionTypes: InterventionType[] = ["none", "survey", "pause", "incentive"];
      const interventionType = rng.choice(interventionTypes);
      const incentiveStrengths: IncentiveStrength[] = ["none", "light", "medium", "heavy"];
      const incentiveStrength = interventionType === "incentive" 
        ? rng.choice(incentiveStrengths.filter(s => s !== "none"))
        : "none";

      // Base save rate varies by intervention type
      let baseSaveRate = 0.05; // 5% baseline for "none"
      if (interventionType === "survey") baseSaveRate = 0.08;
      else if (interventionType === "pause") baseSaveRate = 0.10;
      else if (interventionType === "incentive") {
        if (incentiveStrength === "light") baseSaveRate = 0.12;
        else if (incentiveStrength === "medium") baseSaveRate = 0.18;
        else if (incentiveStrength === "heavy") baseSaveRate = 0.25;
      }

      // Add some noise
      const saveRate = clamp(baseSaveRate + rng.float(-0.03, 0.03), 0.02, 0.35);
      const outcome = rng.next() < saveRate ? "saved" : "canceled";

      // Event date: within last 12 months
      const daysAgo = rng.int(0, 365);
      const eventDate = new Date(now);
      eventDate.setDate(eventDate.getDate() - daysAgo);

      let postEventLifetimeDays: number | undefined;
      if (outcome === "saved") {
        postEventLifetimeDays = rng.int(30, 365);
      }

      const cancellationEvent: CancellationEvent = {
        id: `${plan.id}_cancel_${i + 1}`,
        merchantId: plan.merchantId,
        planId: plan.id,
        eventDate,
        interventionType,
        incentiveStrength,
        outcome,
        postEventLifetimeDays,
      };
      cancellationEvents.push(cancellationEvent);
    }

    // Generate payment failure events: 150-600 per plan
    const numPaymentEvents = rng.int(150, 600);
    for (let i = 0; i < numPaymentEvents; i++) {
      const retries = rng.int(3, 8);
      const retryWindowDays = rng.int(7, 30);
      const fallbackEnabled = rng.next() < 0.4; // 40% have fallback

      // Recovery rate increases with retries, window, and fallback
      let baseRecoveryRate = 0.30;
      baseRecoveryRate += (retries - 3) * 0.05; // +5% per retry above 3
      baseRecoveryRate += (retryWindowDays - 7) * 0.01; // +1% per day above 7
      if (fallbackEnabled) baseRecoveryRate += 0.15;

      const recoveryRate = clamp(baseRecoveryRate + rng.float(-0.10, 0.10), 0.20, 0.80);
      const recovered = rng.next() < recoveryRate;

      const daysAgo = rng.int(0, 365);
      const eventDate = new Date(now);
      eventDate.setDate(eventDate.getDate() - daysAgo);

      let recoveryDays: number | undefined;
      if (recovered) {
        recoveryDays = rng.int(1, retryWindowDays);
      }

      const paymentEvent: PaymentFailureEvent = {
        id: `${plan.id}_payment_${i + 1}`,
        merchantId: plan.merchantId,
        planId: plan.id,
        eventDate,
        retries,
        retryWindowDays,
        fallbackEnabled,
        recovered,
        recoveryDays,
      };
      paymentFailureEvents.push(paymentEvent);
    }

    // Generate pause events: 100-500 per plan
    const numPauseEvents = rng.int(100, 500);
    for (let i = 0; i < numPauseEvents; i++) {
      const pauseEnabled = rng.next() < 0.7; // 70% have pause enabled
      const pauseCycles = pauseEnabled ? rng.int(1, 6) : 0;

      // Resume rate: 55-80% baseline, decreases slightly with more cycles
      let resumeRate = rng.float(0.55, 0.80);
      if (pauseCycles > 3) resumeRate -= 0.10;
      resumeRate = clamp(resumeRate, 0.40, 0.85);

      const resumed = pauseEnabled && rng.next() < resumeRate;

      // If resumed, chance of churning within 90d
      let churnedWithin90d: boolean | undefined;
      if (resumed) {
        const churnRate = rng.float(0.10, 0.25); // 10-25% churn after resume
        churnedWithin90d = rng.next() < churnRate;
      }

      const daysAgo = rng.int(0, 365);
      const eventDate = new Date(now);
      eventDate.setDate(eventDate.getDate() - daysAgo);

      const pauseEvent: PauseEvent = {
        id: `${plan.id}_pause_${i + 1}`,
        merchantId: plan.merchantId,
        planId: plan.id,
        eventDate,
        pauseEnabled,
        pauseCycles,
        resumed,
        churnedWithin90d,
      };
      pauseEvents.push(pauseEvent);
    }
  }

  // Sort churn events by date (newest first)
  cancellationEvents.sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime());
  paymentFailureEvents.sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime());
  pauseEvents.sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime());

  return {
    merchants,
    plans,
    events,
    cancellationEvents,
    paymentFailureEvents,
    pauseEvents,
  };
}

