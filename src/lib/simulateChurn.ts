import { clamp } from './utils';
import { dataset } from '../data/sampleData';
import type { InterventionType, IncentiveStrength } from '../data/types';

export interface ChurnSimulationInput {
  merchantId: string;
  planId: string;
  leverA: {
    type: InterventionType;
    incentiveStrength?: IncentiveStrength;
  };
  leverB: {
    retries: number;
    retryWindowDays: number;
    fallbackEnabled: boolean;
  };
  leverC: {
    pauseEnabled: boolean;
    maxPauseCycles: number;
  };
}

export interface ChurnSimulationResult {
  recoveredARR: number;
  recoveredMRR: number;
  savedSubs: number;
  churnReductionPp: number;
  confidence: "High" | "Med" | "Low";
  warnings: string[];
  evidence: {
    comparableCancellationEvents: number;
    comparablePaymentEvents: number;
    comparablePauseEvents: number;
    merchantCancellationEvents: number;
    merchantPaymentEvents: number;
    merchantPauseEvents: number;
    globalCancellationEvents: number;
    globalPaymentEvents: number;
    globalPauseEvents: number;
  };
  rangeLow: number;
  rangeHigh: number;
  fatigueFactor: number;
}

export function simulateChurn(input: ChurnSimulationInput): ChurnSimulationResult {
  const plan = dataset.plans.find(p => p.id === input.planId);
  if (!plan) {
    throw new Error(`Plan not found: ${input.planId}`);
  }

  // Always start with merchant-specific events (same plan)
  let merchantCancellationEvents = dataset.cancellationEvents.filter(e => 
    e.merchantId === input.merchantId && e.planId === input.planId
  );

  let merchantPaymentEvents = dataset.paymentFailureEvents.filter(e => 
    e.merchantId === input.merchantId && e.planId === input.planId
  );

  let merchantPauseEvents = dataset.pauseEvents.filter(e => 
    e.merchantId === input.merchantId && e.planId === input.planId
  );

  // Always include global events (same plan, different merchant)
  const globalCancellationEvents = dataset.cancellationEvents.filter(e => 
    e.merchantId !== input.merchantId && e.planId === input.planId
  );

  const globalPaymentEvents = dataset.paymentFailureEvents.filter(e => 
    e.merchantId !== input.merchantId && e.planId === input.planId
  );

  const globalPauseEvents = dataset.pauseEvents.filter(e => 
    e.merchantId !== input.merchantId && e.planId === input.planId
  );

  // Combine merchant and global events (always use global data)
  const cancellationEvents = [...merchantCancellationEvents, ...globalCancellationEvents];
  const paymentEvents = [...merchantPaymentEvents, ...globalPaymentEvents];
  const pauseEvents = [...merchantPauseEvents, ...globalPauseEvents];

  // Calculate baseline expectations
  const activeSubs = plan.activeSubs;
  const expectedCancels = activeSubs * plan.baselineCancelRate90d;
  const expectedPaymentFailures = activeSubs * plan.paymentFailureRate90d;
  const expectedDunningLosses = expectedPaymentFailures * (1 - plan.baselineDunningRecoveryRate);

  // Lever A: Cancellation intervention lift
  // Filter matching events from combined merchant + global pool
  const matchingCancellationEvents = cancellationEvents.filter(e => {
    if (input.leverA.type === "incentive") {
      return e.interventionType === input.leverA.type && 
             e.incentiveStrength === input.leverA.incentiveStrength;
    }
    return e.interventionType === input.leverA.type;
  });
  
  // Also get merchant-specific matching events for evidence
  const matchingMerchantCancellationEvents = merchantCancellationEvents.filter(e => {
    if (input.leverA.type === "incentive") {
      return e.interventionType === input.leverA.type && 
             e.incentiveStrength === input.leverA.incentiveStrength;
    }
    return e.interventionType === input.leverA.type;
  });

  const baselineNoneEvents = cancellationEvents.filter(e => e.interventionType === "none");
  const baselineNoneSaved = baselineNoneEvents.filter(e => e.outcome === "saved").length;
  const baselineNoneSaveRate = baselineNoneEvents.length > 0 
    ? baselineNoneSaved / baselineNoneEvents.length 
    : 0.05;

  const configuredSaved = matchingCancellationEvents.filter(e => e.outcome === "saved").length;
  const configuredSaveRate = matchingCancellationEvents.length > 0
    ? configuredSaved / matchingCancellationEvents.length
    : baselineNoneSaveRate;

  const saveLiftA = configuredSaveRate - baselineNoneSaveRate;
  const savedSubsA = expectedCancels * clamp(saveLiftA, -0.05, 0.35);

  // Lever B: Dunning lift
  const matchingPaymentEvents = paymentEvents.filter(e => {
    return e.retries === input.leverB.retries &&
           e.retryWindowDays === input.leverB.retryWindowDays &&
           e.fallbackEnabled === input.leverB.fallbackEnabled;
  });
  
  // Also get merchant-specific matching events for evidence
  const matchingMerchantPaymentEvents = merchantPaymentEvents.filter(e => {
    return e.retries === input.leverB.retries &&
           e.retryWindowDays === input.leverB.retryWindowDays &&
           e.fallbackEnabled === input.leverB.fallbackEnabled;
  });

  const baselinePaymentEvents = paymentEvents.filter(e => 
    e.retries === 3 && e.retryWindowDays === 7 && !e.fallbackEnabled
  );
  const baselineRecovered = baselinePaymentEvents.filter(e => e.recovered).length;
  const baselineRecoveryRate = baselinePaymentEvents.length > 0
    ? baselineRecovered / baselinePaymentEvents.length
    : plan.baselineDunningRecoveryRate;

  const configuredRecovered = matchingPaymentEvents.filter(e => e.recovered).length;
  const configuredRecoveryRate = matchingPaymentEvents.length > 0
    ? configuredRecovered / matchingPaymentEvents.length
    : baselineRecoveryRate;

  const recoveryLiftB = configuredRecoveryRate - baselineRecoveryRate;
  const savedSubsB = expectedDunningLosses * clamp(recoveryLiftB, -0.10, 0.60);

  // Lever C: Pause lift
  let savedSubsC = 0;
  if (input.leverC.pauseEnabled) {
    const matchingPauseEvents = pauseEvents.filter(e => 
      e.pauseEnabled && e.pauseCycles <= input.leverC.maxPauseCycles
    );
    
    // Effective resume rate: resumed AND not churned within 90d
    const configuredResumedNotChurned = matchingPauseEvents.filter(e => 
      e.resumed && e.churnedWithin90d === false
    ).length;
    const effectiveResumeRateConfigured = matchingPauseEvents.length > 0
      ? configuredResumedNotChurned / matchingPauseEvents.length
      : 0;

    // For baseline, we compare against events where pause was not available
    // Since baseline has no pause, effective resume rate is 0 (they can't resume if they can't pause)
    const effectiveResumeRateBaseline = 0;

    const pauseLiftC = effectiveResumeRateConfigured - effectiveResumeRateBaseline;
    savedSubsC = expectedCancels * plan.baselinePauseAdoptionRate * clamp(pauseLiftC, -0.10, 0.50);
  }

  // Combine with diminishing returns (fatigue factor)
  const totalSavedRaw = savedSubsA + savedSubsB + savedSubsC;

  let fatigueFactor = 0;
  if (input.leverA.type === "incentive" && input.leverA.incentiveStrength === "heavy") {
    fatigueFactor += 0.20;
  }
  if (input.leverB.retries >= 7) {
    fatigueFactor += 0.10;
  }
  if (input.leverB.retryWindowDays >= 21) {
    fatigueFactor += 0.10;
  }
  if (input.leverB.fallbackEnabled) {
    fatigueFactor += 0.05;
  }
  if (input.leverC.maxPauseCycles >= 4) {
    fatigueFactor += 0.10;
  }
  fatigueFactor = clamp(fatigueFactor, 0, 0.50);

  const effectiveSavedSubs = totalSavedRaw * (1 - fatigueFactor);

  // Calculate recovered ARR
  const planMonthlyEquivalent = plan.currentPriceMonthly + plan.arpuAddonsMonthly;
  const recoveredMRR = effectiveSavedSubs * planMonthlyEquivalent;
  const recoveredARR = recoveredMRR * 12;

  // Determine confidence based on comparable event counts
  // Count includes both merchant and global events
  const comparableCancellationEvents = matchingCancellationEvents.length;
  const comparablePaymentEvents = matchingPaymentEvents.length;
  
  let comparablePauseEvents = 0;
  let matchingMerchantPauseEvents: typeof pauseEvents = [];
  if (input.leverC.pauseEnabled) {
    const matchingPauseEvents = pauseEvents.filter(e => 
      e.pauseEnabled && e.pauseCycles <= input.leverC.maxPauseCycles
    );
    comparablePauseEvents = matchingPauseEvents.length;
    matchingMerchantPauseEvents = merchantPauseEvents.filter(e => 
      e.pauseEnabled && e.pauseCycles <= input.leverC.maxPauseCycles
    );
  }
  
  const totalComparableEvents = comparableCancellationEvents + comparablePaymentEvents + comparablePauseEvents;
  
  // Calculate merchant vs global event counts for evidence display
  const merchantCancellationCount = matchingMerchantCancellationEvents.length;
  const globalCancellationCount = comparableCancellationEvents - merchantCancellationCount;
  
  const merchantPaymentCount = matchingMerchantPaymentEvents.length;
  const globalPaymentCount = comparablePaymentEvents - merchantPaymentCount;
  
  const merchantPauseCount = matchingMerchantPauseEvents.length;
  const globalPauseCount = comparablePauseEvents - merchantPauseCount;

  let confidence: "High" | "Med" | "Low" = "Low";
  if (totalComparableEvents >= 100) {
    confidence = "High";
  } else if (totalComparableEvents >= 30) {
    confidence = "Med";
  }

  // Calculate range based on confidence
  let rangeMultiplier = 0.50; // Low confidence: ±50%
  if (confidence === "High") {
    rangeMultiplier = 0.15; // ±15%
  } else if (confidence === "Med") {
    rangeMultiplier = 0.30; // ±30%
  }

  const rangeLow = recoveredARR * (1 - rangeMultiplier);
  const rangeHigh = recoveredARR * (1 + rangeMultiplier);

  // Calculate churn reduction (percentage points)
  const baselineChurn90d = plan.baselineChurn90d;
  const totalExpectedChurn = expectedCancels + expectedDunningLosses;
  const churnReductionPp = totalExpectedChurn > 0
    ? (effectiveSavedSubs / totalExpectedChurn) * baselineChurn90d * 100
    : 0;

  // Generate warnings
  const warnings: string[] = [];
  const pctSavedSubs = totalExpectedChurn > 0 
    ? effectiveSavedSubs / totalExpectedChurn 
    : 0;

  if (pctSavedSubs > 0.30) {
    warnings.push("This configuration is unusually aggressive; estimated recovery may be overstated and could introduce customer experience risk.");
  }

  const isAggressive = 
    (input.leverA.type === "incentive" && input.leverA.incentiveStrength === "heavy") ||
    input.leverB.retries >= 7 ||
    input.leverB.retryWindowDays >= 25 ||
    input.leverC.maxPauseCycles >= 5;

  if (isAggressive && warnings.length === 0) {
    warnings.push("This configuration is unusually aggressive; estimated recovery may be overstated and could introduce customer experience risk.");
  }

  return {
    recoveredARR,
    recoveredMRR,
    savedSubs: effectiveSavedSubs,
    churnReductionPp,
    confidence,
    warnings,
    evidence: {
      comparableCancellationEvents,
      comparablePaymentEvents,
      comparablePauseEvents,
      merchantCancellationEvents: merchantCancellationCount,
      merchantPaymentEvents: merchantPaymentCount,
      merchantPauseEvents: merchantPauseCount,
      globalCancellationEvents: globalCancellationCount,
      globalPaymentEvents: globalPaymentCount,
      globalPauseEvents: globalPauseCount,
    },
    rangeLow,
    rangeHigh,
    fatigueFactor,
  };
}
