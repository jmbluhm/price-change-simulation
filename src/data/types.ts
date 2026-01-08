export type Vertical = "Streaming Service";

export interface Merchant {
  id: string;
  name: string;
  vertical: Vertical;
}

export type PlanInterval = "monthly" | "annual";

export interface Plan {
  id: string;
  merchantId: string;
  name: string;
  interval: PlanInterval;
  currentPriceMonthly: number;
  activeSubs: number;
  baselineChurn90d: number; // 0-1, e.g., 0.05 = 5%
  arpuAddonsMonthly: number;
  createdAt: Date;
  // Churn simulation baseline rates
  baselineCancelRate90d: number; // 0-1, e.g., 0.05 = 5%
  paymentFailureRate90d: number; // 0-1, e.g., 0.03 = 3%
  baselineDunningRecoveryRate: number; // 0-1, e.g., 0.50 = 50%
  baselinePauseAdoptionRate: number; // 0-1, e.g., 0.08 = 8%
}

export interface PriceChangeEvent {
  id: string;
  merchantId: string;
  planId: string;
  effectiveDate: Date;
  oldPriceMonthly: number;
  newPriceMonthly: number;
  pctChange: number; // e.g., 0.10 = +10%
  churn90dTreatment: number; // 0-1
  churn90dControl: number; // 0-1
  notes?: string;
}

export type InterventionType = "none" | "survey" | "pause" | "incentive";
export type IncentiveStrength = "none" | "light" | "medium" | "heavy";

export interface CancellationEvent {
  id: string;
  merchantId: string;
  planId: string;
  eventDate: Date;
  interventionType: InterventionType;
  incentiveStrength: IncentiveStrength;
  outcome: "saved" | "canceled";
  postEventLifetimeDays?: number;
}

export interface PaymentFailureEvent {
  id: string;
  merchantId: string;
  planId: string;
  eventDate: Date;
  retries: number;
  retryWindowDays: number;
  fallbackEnabled: boolean;
  recovered: boolean;
  recoveryDays?: number;
}

export interface PauseEvent {
  id: string;
  merchantId: string;
  planId: string;
  eventDate: Date;
  pauseEnabled: boolean;
  pauseCycles: number;
  resumed: boolean;
  churnedWithin90d?: boolean;
}

export interface Dataset {
  merchants: Merchant[];
  plans: Plan[];
  events: PriceChangeEvent[];
  cancellationEvents: CancellationEvent[];
  paymentFailureEvents: PaymentFailureEvent[];
  pauseEvents: PauseEvent[];
}

