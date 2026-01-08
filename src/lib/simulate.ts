import { clamp } from './utils';
import { dataset } from '../data/sampleData';
import type { PriceChangeEvent } from '../data/types';

// Price shock constants
const SAFE_INCREASE_PCT = 0.25;       // price increases up to +25% are "normal"; no shock
const SHOCK_RAMP_PCT = 0.15;          // how quickly shock ramps after threshold
const MAX_CHURN_90D = 0.90;            // absolute ceiling for 90-day churn under extreme shock

// Smoothstep function for smooth interpolation (0 at x=0, 1 at x=1)
function smoothstep(x: number): number {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
}

export interface SimulationInput {
  merchantId: string;
  planId: string;
  newPriceMonthly: number;
  useGlobalBenchmarks: boolean;
}

export interface ComparableEvent {
  event: PriceChangeEvent;
  weight: number;
  similarity: number;
  isGlobal: boolean;
}

export interface SimulationResult {
  inputs: SimulationInput;
  evidenceCount: number;
  confidence: "High" | "Med" | "Low";
  baselineChurn90d: number;
  expectedChurn90d: number;
  churnLift: number;
  baselineMRR: number;
  newMRR: number;
  netMRRDelta: number;
  netARRDelta: number;
  rangeLow: number;
  rangeHigh: number;
  topComparableEvents: ComparableEvent[];
  usedHeuristic: boolean;
  appliedPriceShock?: boolean;
  priceShockWeight?: number;
  priceShockNote?: string;
}

export function simulate(input: SimulationInput): SimulationResult {
  const plan = dataset.plans.find(p => p.id === input.planId);
  if (!plan) {
    throw new Error(`Plan not found: ${input.planId}`);
  }

  const oldPrice = plan.currentPriceMonthly;
  const pctChange = (input.newPriceMonthly - oldPrice) / oldPrice;

  // Always start with merchant-specific events
  let merchantEvents = dataset.events.filter(e => {
    const eventPlan = dataset.plans.find(p => p.id === e.planId);
    return (
      e.merchantId === input.merchantId &&
      eventPlan?.interval === plan.interval
    );
  });

  // Prefer same planId if available
  const samePlanEvents = merchantEvents.filter(e => e.planId === input.planId);
  if (samePlanEvents.length >= 3) {
    merchantEvents = samePlanEvents;
  }

  // Collect global events if useGlobalBenchmarks is enabled
  let globalEvents: PriceChangeEvent[] = [];
  if (input.useGlobalBenchmarks) {
    // Global: same interval, exclude current merchant
    globalEvents = dataset.events.filter(e => {
      const eventPlan = dataset.plans.find(p => p.id === e.planId);
      return (
        e.merchantId !== input.merchantId &&
        eventPlan?.interval === plan.interval
      );
    });
  }

  // Combine events and calculate evidence-based weights
  const merchantCount = merchantEvents.length;
  const globalCount = globalEvents.length;
  const totalCount = merchantCount + globalCount;

  let merchantWeight = 1;
  let globalWeight = 0;
  if (totalCount > 0) {
    merchantWeight = merchantCount / totalCount;
    globalWeight = globalCount / totalCount;
  }

  // Combine all events into one pool
  const candidateEvents: Array<{ event: PriceChangeEvent; isGlobal: boolean }> = [
    ...merchantEvents.map(e => ({ event: e, isGlobal: false })),
    ...globalEvents.map(e => ({ event: e, isGlobal: true })),
  ];

  // Weight events by similarity
  const weightedEvents: ComparableEvent[] = candidateEvents.map(({ event, isGlobal }) => {
    // Weight 1: closeness of pctChange
    const pctDiff = Math.abs(event.pctChange - pctChange);
    
    // For extreme changes, use more lenient similarity matching
    // This helps find comparable extreme events even if they don't match exactly
    const absPctChange = Math.abs(pctChange);
    const absEventPctChange = Math.abs(event.pctChange);
    const isExtremeChange = absPctChange > 0.50 || absEventPctChange > 0.50;
    
    let w1: number;
    if (isExtremeChange) {
      // For extreme changes, use relative difference instead of absolute
      // This way a 200% change and 150% change are considered more similar
      const relativeDiff = pctDiff / Math.max(absPctChange, absEventPctChange, 0.10);
      w1 = Math.exp(-relativeDiff * 5); // More lenient decay for extreme changes
    } else {
      w1 = Math.exp(-pctDiff * 10); // Standard exponential decay for normal changes
    }

    // Weight 2: closeness of oldPrice (for global events)
    let w2 = 1;
    if (isGlobal) {
      const priceDiff = Math.abs(event.oldPriceMonthly - oldPrice);
      const priceBand = oldPrice * 0.30; // ±30%
      w2 = Math.max(0, 1 - priceDiff / priceBand);
    }

    const similarity = w1 * w2;
    
    // Apply evidence-based weight to similarity
    const evidenceWeight = isGlobal ? globalWeight : merchantWeight;
    const weight = similarity * evidenceWeight;

    return {
      event,
      weight,
      similarity,
      isGlobal,
    };
  });

  // Sort by weight descending
  weightedEvents.sort((a, b) => b.weight - a.weight);

  // Compute churn lift
  let churnLift = 0;
  let usedHeuristic = false;
  const evidenceCount = weightedEvents.length;

  // Calculate extreme change multiplier for non-linear scaling
  // For extreme changes, apply quadratic scaling to make predictions more sensitive
  const absPctChange = Math.abs(pctChange);
  let extremeMultiplier = 1;
  if (absPctChange > 0.50) {
    // For changes > 50%, apply quadratic scaling
    // Example: 100% change -> 2x multiplier, 200% change -> 4x multiplier
    const excessChange = absPctChange - 0.50;
    extremeMultiplier = 1 + (excessChange / 0.50) * (excessChange / 0.50); // Quadratic scaling
  }

  if (evidenceCount < 5) {
    // Fallback to heuristic with non-linear scaling for extreme changes
    usedHeuristic = true;
    if (pctChange > 0) {
      // Base linear scaling: +10% -> +1.2pp
      churnLift = 0.012 * (pctChange / 0.10);
      // Apply extreme multiplier for large increases
      churnLift = churnLift * extremeMultiplier;
      // Cap based on magnitude: allow up to 40pp for extreme changes
      const maxLift = Math.min(0.40, 0.06 + (absPctChange - 0.10) * 0.20);
      churnLift = clamp(churnLift, 0, maxLift);
    } else {
      // Base linear scaling: -10% -> -0.6pp
      churnLift = 0.006 * (pctChange / 0.10);
      // Apply extreme multiplier for large decreases
      churnLift = churnLift * extremeMultiplier;
      // Cap based on magnitude: allow up to -20pp for extreme decreases
      const maxLift = Math.min(0.20, 0.06 + (absPctChange - 0.10) * 0.10);
      churnLift = clamp(churnLift, -maxLift, 0);
    }
  } else {
    // Use weighted average of lifts
    const totalWeight = weightedEvents.reduce((sum, we) => sum + we.weight, 0);
    if (totalWeight > 0) {
      const weightedLifts = weightedEvents.map(we => {
        const lift = we.event.churn90dTreatment - we.event.churn90dControl;
        return lift * we.weight;
      });
      churnLift = weightedLifts.reduce((sum, wl) => sum + wl, 0) / totalWeight;
      
      // Apply extreme change adjustment when price change is extreme
      // This accounts for the fact that historical data may not have extreme examples
      if (absPctChange > 0.50) {
        // Calculate weighted average historical pct change magnitude from comparable events
        const totalHistoricalPctChange = weightedEvents.reduce((sum, we) => {
          return sum + Math.abs(we.event.pctChange) * we.weight;
        }, 0);
        const avgHistoricalPctChange = totalHistoricalPctChange / totalWeight;
        
        // If current change is significantly more extreme than historical average, apply adjustment
        if (absPctChange > avgHistoricalPctChange * 1.5 && avgHistoricalPctChange > 0) {
          // Scale up the churn lift proportionally to how much more extreme this change is
          // Use a moderate scaling factor to avoid over-prediction
          const extremeRatio = absPctChange / avgHistoricalPctChange;
          const extremeAdjustment = (extremeRatio - 1.5) * 0.3; // Moderate scaling
          churnLift = churnLift * (1 + Math.max(0, extremeAdjustment));
        }
      }
    }
    
    // Dynamic clamp based on price change magnitude
    const maxLift = pctChange > 0 
      ? Math.min(0.50, 0.15 + (absPctChange - 0.25) * 0.70) // Up to 50pp for extreme increases
      : Math.min(0.30, 0.15 + (absPctChange - 0.25) * 0.30); // Up to 30pp for extreme decreases
    churnLift = clamp(churnLift, -maxLift, maxLift);
  }

  // Compute data-driven expected churn (from historical events)
  const baselineChurn90d = plan.baselineChurn90d;
  const dataDrivenExpectedChurn90d = clamp(baselineChurn90d + churnLift, 0, 0.5);

  // Apply price shock adjustment for extreme price increases
  let expectedChurn90d = dataDrivenExpectedChurn90d;
  let appliedPriceShock = false;
  let priceShockWeight = 0;
  let priceShockNote: string | undefined;

  if (pctChange > SAFE_INCREASE_PCT) {
    // Compute shock weight using smoothstep
    const excess = pctChange - SAFE_INCREASE_PCT;
    const t = clamp(excess / (3 * SHOCK_RAMP_PCT), 0, 1);
    priceShockWeight = smoothstep(t);

    // Blend toward MAX_CHURN_90D
    const shockedExpectedChurn90d = dataDrivenExpectedChurn90d + priceShockWeight * (MAX_CHURN_90D - dataDrivenExpectedChurn90d);
    expectedChurn90d = clamp(shockedExpectedChurn90d, 0, MAX_CHURN_90D);

    appliedPriceShock = true;
    priceShockNote = "Extreme price increase detected; applied non-linear price shock adjustment to prevent unrealistic retention assumptions.";
  }

  // Compute ARR impacts using final expected churn
  const baselineMRR = plan.activeSubs * oldPrice + plan.activeSubs * plan.arpuAddonsMonthly;
  const incrementalChurnedSubs = plan.activeSubs * Math.max(expectedChurn90d - baselineChurn90d, 0);
  const retainedSubs = plan.activeSubs - incrementalChurnedSubs;
  const newMRR = retainedSubs * input.newPriceMonthly + retainedSubs * plan.arpuAddonsMonthly;
  const netMRRDelta = newMRR - baselineMRR;
  const netARRDelta = netMRRDelta * 12;

  // Compute range (simplified: use ±1 std error if available, else ±20%)
  let rangeLow = netARRDelta;
  let rangeHigh = netARRDelta;
  
  if (!usedHeuristic && evidenceCount >= 5) {
    // Estimate range based on lift uncertainty
    // Apply same price shock adjustment to range calculations
    const liftRange = 0.02; // Rough estimate
    let lowChurn = clamp(baselineChurn90d + churnLift - liftRange, 0, 0.5);
    let highChurn = clamp(baselineChurn90d + churnLift + liftRange, 0, 0.5);
    
    // Apply price shock to range if applicable
    if (appliedPriceShock) {
      const lowShocked = lowChurn + priceShockWeight * (MAX_CHURN_90D - lowChurn);
      const highShocked = highChurn + priceShockWeight * (MAX_CHURN_90D - highChurn);
      lowChurn = clamp(lowShocked, 0, MAX_CHURN_90D);
      highChurn = clamp(highShocked, 0, MAX_CHURN_90D);
    }
    
    const lowRetained = plan.activeSubs - plan.activeSubs * Math.max(lowChurn - baselineChurn90d, 0);
    const highRetained = plan.activeSubs - plan.activeSubs * Math.max(highChurn - baselineChurn90d, 0);
    
    const lowMRR = lowRetained * input.newPriceMonthly + lowRetained * plan.arpuAddonsMonthly;
    const highMRR = highRetained * input.newPriceMonthly + highRetained * plan.arpuAddonsMonthly;
    
    rangeLow = (lowMRR - baselineMRR) * 12;
    rangeHigh = (highMRR - baselineMRR) * 12;
  } else {
    // Heuristic: ±20% range
    const range = Math.abs(netARRDelta) * 0.20;
    rangeLow = netARRDelta - range;
    rangeHigh = netARRDelta + range;
  }

  // Determine confidence
  let confidence: "High" | "Med" | "Low" = "Low";
  if (evidenceCount >= 25) {
    confidence = "High";
  } else if (evidenceCount >= 10) {
    confidence = "Med";
  }

  // Top comparable events (max 6)
  const topComparableEvents = weightedEvents.slice(0, 6);

  return {
    inputs: input,
    evidenceCount,
    confidence,
    baselineChurn90d,
    expectedChurn90d,
    churnLift,
    baselineMRR,
    newMRR,
    netMRRDelta,
    netARRDelta,
    rangeLow,
    rangeHigh,
    topComparableEvents,
    usedHeuristic,
    appliedPriceShock: appliedPriceShock || undefined,
    priceShockWeight: appliedPriceShock ? priceShockWeight : undefined,
    priceShockNote: appliedPriceShock ? priceShockNote : undefined,
  };
}

export interface PriceOptimizationDataPoint {
  price: number;
  arrImpact: number;
  expectedChurn90d: number;
}

export interface PriceOptimizationResult {
  dataPoints: PriceOptimizationDataPoint[];
  optimalPrice: number;
  optimalARRImpact: number;
  optimalChurnPrice: number;
  optimalChurn90d: number;
  optimalChurnARRImpact: number;
  currentPrice: number;
  currentARRImpact: number;
  currentChurn90d: number;
}

/**
 * Find optimal price by running simulations across a range of prices
 * @param merchantId - The merchant ID
 * @param planId - The plan ID
 * @param useGlobalBenchmarks - Whether to use global benchmarks
 * @param priceRange - Range of prices to test (as multipliers of current price), default [-0.5, 1.0] (50% decrease to 100% increase)
 * @param steps - Number of price points to test, default 50
 */
export function findOptimalPrice(
  merchantId: string,
  planId: string,
  useGlobalBenchmarks: boolean,
  priceRange: [number, number] = [-0.5, 1.0],
  steps: number = 50
): PriceOptimizationResult {
  const plan = dataset.plans.find(p => p.id === planId);
  if (!plan) {
    throw new Error(`Plan not found: ${planId}`);
  }

  const currentPrice = plan.currentPriceMonthly;
  const baselineARR = (plan.activeSubs * currentPrice + plan.activeSubs * plan.arpuAddonsMonthly) * 12;
  const minPrice = currentPrice * (1 + priceRange[0]);
  const maxPrice = currentPrice * (1 + priceRange[1]);
  const priceStep = (maxPrice - minPrice) / steps;

  const dataPoints: PriceOptimizationDataPoint[] = [];
  let optimalPrice = currentPrice;
  let optimalARRImpact = 0;
  let optimalChurnPrice = currentPrice;
  let optimalChurn90d = plan.baselineChurn90d;
  let optimalChurnARRImpact = 0;
  let currentARRImpact = 0;
  let currentChurn90d = plan.baselineChurn90d;

  // Minimum price constraint: don't go below 50% of current price (to avoid free pricing)
  const minAllowedPrice = currentPrice * 0.5;
  // Maximum acceptable ARR loss for churn optimization: don't lose more than 10% of baseline ARR
  const maxARRLoss = baselineARR * -0.10;

  // Run simulations across the price range
  for (let i = 0; i <= steps; i++) {
    const testPrice = minPrice + (priceStep * i);
    // Skip negative or zero prices, and prices below minimum allowed
    if (testPrice <= 0 || testPrice < minAllowedPrice) continue;

    try {
      const result = simulate({
        merchantId,
        planId,
        newPriceMonthly: testPrice,
        useGlobalBenchmarks,
      });

      const arrImpact = result.netARRDelta;
      dataPoints.push({
        price: testPrice,
        arrImpact,
        expectedChurn90d: result.expectedChurn90d,
      });

      // Track optimal price (maximum ARR impact)
      if (arrImpact > optimalARRImpact) {
        optimalARRImpact = arrImpact;
        optimalPrice = testPrice;
      }

      // Track optimal churn price (minimum churn, but with constraints)
      // Constraint 1: ARR impact must be >= maxARRLoss (don't lose too much revenue)
      // Constraint 2: Price must be >= minAllowedPrice (avoid free pricing)
      const meetsARRConstraint = arrImpact >= maxARRLoss;
      const meetsPriceConstraint = testPrice >= minAllowedPrice;
      
      if (meetsARRConstraint && meetsPriceConstraint) {
        // Within constraints, find minimum churn
        if (result.expectedChurn90d < optimalChurn90d) {
          optimalChurn90d = result.expectedChurn90d;
          optimalChurnPrice = testPrice;
          optimalChurnARRImpact = arrImpact;
        }
      }

      // Track current price impact
      if (Math.abs(testPrice - currentPrice) < priceStep / 2) {
        currentARRImpact = arrImpact;
        currentChurn90d = result.expectedChurn90d;
      }
    } catch (error) {
      // Skip prices that cause simulation errors
      console.warn(`Simulation failed for price ${testPrice}:`, error);
    }
  }

  // If we didn't find current price impact, run a simulation for it
  if (currentARRImpact === 0 && dataPoints.length > 0) {
    try {
      const currentResult = simulate({
        merchantId,
        planId,
        newPriceMonthly: currentPrice,
        useGlobalBenchmarks,
      });
      currentARRImpact = currentResult.netARRDelta;
      currentChurn90d = currentResult.expectedChurn90d;
    } catch (error) {
      // Use closest data point
      const closest = dataPoints.reduce((prev, curr) => 
        Math.abs(curr.price - currentPrice) < Math.abs(prev.price - currentPrice) ? curr : prev
      );
      currentARRImpact = closest.arrImpact;
      currentChurn90d = closest.expectedChurn90d;
    }
  }

  // If no churn-optimal price found within constraints, fall back to finding minimum churn
  // within a reasonable price range (50% to 150% of current)
  if (optimalChurnPrice === currentPrice && optimalChurn90d === plan.baselineChurn90d) {
    const reasonableMinPrice = currentPrice * 0.5;
    const reasonableMaxPrice = currentPrice * 1.5;
    
    for (const point of dataPoints) {
      if (point.price >= reasonableMinPrice && point.price <= reasonableMaxPrice) {
        if (point.expectedChurn90d < optimalChurn90d) {
          optimalChurn90d = point.expectedChurn90d;
          optimalChurnPrice = point.price;
          optimalChurnARRImpact = point.arrImpact;
        }
      }
    }
  }

  // Sort data points by price for smooth curve
  dataPoints.sort((a, b) => a.price - b.price);

  return {
    dataPoints,
    optimalPrice,
    optimalARRImpact,
    optimalChurnPrice,
    optimalChurn90d,
    optimalChurnARRImpact,
    currentPrice,
    currentARRImpact,
    currentChurn90d,
  };
}

