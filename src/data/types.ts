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

export interface Dataset {
  merchants: Merchant[];
  plans: Plan[];
  events: PriceChangeEvent[];
}

