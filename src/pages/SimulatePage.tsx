import { useState, useMemo, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Cell, LineChart, Line, ReferenceLine } from 'recharts';
import { dataset, TEST_MERCHANT_ID } from '../data/sampleData';
import { simulate, type SimulationResult, findOptimalPrice, type PriceOptimizationResult } from '../lib/simulate';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { formatCurrency, formatPercent, formatPercentChange, formatDate } from '../lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

// Custom Tooltip component for the optimization chart
interface OptimizationTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey?: string;
    value?: number;
    color?: string;
  }>;
  label?: number;
}

const OptimizationTooltip = ({ active, payload, label }: OptimizationTooltipProps) => {
  if (active && payload && payload.length > 0 && label !== undefined) {
    const price = label;
    const arrImpact = payload.find((p) => p.dataKey === 'arrImpact')?.value as number | undefined;
    const churnImpact = payload.find((p) => p.dataKey === 'churnImpact')?.value as number | undefined;

    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3">
        <p className="font-semibold text-slate-900 mb-2">
          Price: {formatCurrency(price)}
        </p>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-sm text-slate-600">ARR Impact:</span>
            <span className="text-sm font-semibold text-slate-900">
              {arrImpact !== undefined && arrImpact !== null ? formatCurrency(arrImpact) : '$0'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-sm text-slate-600">Churn Impact:</span>
            <span className="text-sm font-semibold text-slate-900">
              {churnImpact !== undefined && churnImpact !== null ? formatPercentChange(churnImpact) : '0%'}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// Extreme price change thresholds
const EXTREME_INCREASE_PCT = 0.50;   // +50% or more
const EXTREME_DECREASE_PCT = -0.30;   // -30% or more decrease

export function SimulatePage() {
  const [merchantId, setMerchantId] = useState<string>(TEST_MERCHANT_ID);
  const [planId, setPlanId] = useState<string>("");
  const [newPrice, setNewPrice] = useState<string>("");
  const [useGlobalBenchmarks, setUseGlobalBenchmarks] = useState<boolean>(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [showExtremeWarning, setShowExtremeWarning] = useState(false);
  const [pendingRun, setPendingRun] = useState<null | { pctChange: number; direction: "increase" | "decrease" }>(null);
  const [skipWarnings, setSkipWarnings] = useState(false);
  const [acknowledgedExtreme, setAcknowledgedExtreme] = useState(false);
  const [priceOptimization, setPriceOptimization] = useState<PriceOptimizationResult | null>(null);
  const [isCalculatingOptimal, setIsCalculatingOptimal] = useState(false);

  // Get available plans for selected merchant (always merchant-scoped)
  const availablePlans = useMemo(() => {
    return dataset.plans.filter(p => p.merchantId === merchantId);
  }, [merchantId]);

  // Track previous availablePlans to detect changes
  const prevAvailablePlansRef = useRef(availablePlans);
  
  // Set default plan when merchant changes (only when availablePlans actually changes)
  useEffect(() => {
    const plansChanged = prevAvailablePlansRef.current !== availablePlans;
    if (plansChanged && availablePlans.length > 0) {
      const currentPlanExists = availablePlans.find(p => p.id === planId);
      if (!currentPlanExists) {
        // Schedule state update for next tick to avoid synchronous setState in effect
        queueMicrotask(() => {
          setPlanId(availablePlans[0].id);
          setNewPrice("");
          setResult(null);
          setPriceOptimization(null);
        });
      }
      prevAvailablePlansRef.current = availablePlans;
    }
  }, [availablePlans, planId]);

  const selectedPlan = dataset.plans.find(p => p.id === planId);

  // Transform optimization data to include churn impact, relative to current price baseline
  const chartDataWithChurnImpact = useMemo(() => {
    if (!priceOptimization || !selectedPlan) return [];
    const baselineChurn = selectedPlan.baselineChurn90d;
    
    // Get baseline values at current price (should be 0, but calculate for accuracy)
    const currentPriceBaselineARRImpact = priceOptimization.currentARRImpact;
    const currentPriceBaselineChurnImpact = priceOptimization.currentChurn90d - baselineChurn;
    
    return priceOptimization.dataPoints.map(point => ({
      ...point,
      // Make ARR impact relative to current price (subtract baseline)
      arrImpact: point.arrImpact - currentPriceBaselineARRImpact,
      // Make churn impact relative to current price (subtract baseline)
      churnImpact: (point.expectedChurn90d - baselineChurn) - currentPriceBaselineChurnImpact,
    }));
  }, [priceOptimization, selectedPlan]);

  const runSimulation = () => {
    if (!planId || !newPrice || !selectedPlan) return;
    
    const price = parseFloat(newPrice);
    if (isNaN(price) || price <= 0) return;

    try {
      const simResult = simulate({
        merchantId,
        planId,
        newPriceMonthly: price,
        useGlobalBenchmarks,
      });
      setResult(simResult);
      if (acknowledgedExtreme || pendingRun) {
        setAcknowledgedExtreme(true);
      }

      // Calculate price optimization after simulation runs
      setIsCalculatingOptimal(true);
      setTimeout(() => {
        try {
          const optimization = findOptimalPrice(
            merchantId,
            planId,
            useGlobalBenchmarks,
            [-0.5, 1.0], // Test prices from -50% to +100% of current (centered around current)
            50 // 50 data points for smooth curve
          );
          setPriceOptimization(optimization);
        } catch (error) {
          console.error("Price optimization error:", error);
          setPriceOptimization(null);
        } finally {
          setIsCalculatingOptimal(false);
        }
      }, 0);
    } catch (error) {
      console.error("Simulation error:", error);
    }
  };

  const handleSimulate = () => {
    if (!planId || !newPrice || !selectedPlan) return;
    
    const price = parseFloat(newPrice);
    if (isNaN(price) || price <= 0) return;

    // Calculate percentage change
    const oldPrice = selectedPlan.currentPriceMonthly;
    const pctChange = (price - oldPrice) / oldPrice;

    // Check for extreme price change
    const isExtremeIncrease = pctChange >= EXTREME_INCREASE_PCT;
    const isExtremeDecrease = pctChange <= EXTREME_DECREASE_PCT;

    if (!skipWarnings && (isExtremeIncrease || isExtremeDecrease)) {
      // Show warning modal
      setPendingRun({
        pctChange,
        direction: isExtremeIncrease ? "increase" : "decrease",
      });
      setShowExtremeWarning(true);
      return;
    }

    // Run simulation immediately
    runSimulation();
  };

  const handleRunAnyway = () => {
    setShowExtremeWarning(false);
    setAcknowledgedExtreme(true);
    setPendingRun(null);
    runSimulation();
  };

  const handleGoBack = () => {
    setShowExtremeWarning(false);
    setPendingRun(null);
  };

  // Waterfall chart data
  const waterfallData = result && selectedPlan ? (() => {
    const baselineARR = result.baselineMRR * 12;
    
    // Calculate components
    const oldPrice = selectedPlan.currentPriceMonthly;
    const newPriceVal = parseFloat(newPrice);
    const retainedSubs = selectedPlan.activeSubs * (1 - result.expectedChurn90d);
    const incrementalChurnedSubs = selectedPlan.activeSubs * Math.max(result.expectedChurn90d - result.baselineChurn90d, 0);
    
    // Price uplift: benefit from higher price on retained subs
    const priceUplift = (newPriceVal - oldPrice) * retainedSubs * 12;
    
    // Churn loss: revenue lost from incremental churned subscribers
    const churnLoss = -oldPrice * incrementalChurnedSubs * 12;
    
    const netARR = result.netARRDelta;
    
    return [
      { name: 'Baseline ARR', value: baselineARR, type: 'baseline' },
      { name: 'Price Uplift', value: priceUplift, type: 'uplift' },
      { name: 'Churn Loss', value: churnLoss, type: 'churn' },
      { name: 'Net ARR', value: netARR, type: 'net' },
    ];
  })() : [];

  // Churn comparison data
  const churnData = result ? [
    { name: 'Baseline', churn: result.baselineChurn90d * 100 },
    { name: 'Expected', churn: result.expectedChurn90d * 100 },
  ] : [];

  const pctDisplay = pendingRun ? Math.abs(pendingRun.pctChange * 100).toFixed(1) : "0.0";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Extreme Price Change Warning Modal */}
      <Modal
        open={showExtremeWarning}
        title="Extreme price change"
        onClose={handleGoBack}
      >
        <div className="space-y-4">
          <p className="text-slate-700">
            This change represents a <strong>{pctDisplay}% {pendingRun?.direction}</strong> in price.
          </p>
          <p className="text-slate-700">
            Extreme changes reduce the accuracy of this prototype's estimates because there are fewer comparable historical price-change events in the dataset.
          </p>
          <p className="text-slate-700">
            We'll still run the simulation, but treat the result as directional.
          </p>
          
          <div className="pt-4 border-t border-slate-200">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={skipWarnings}
                onChange={(e) => setSkipWarnings(e.target.checked)}
                className="w-4 h-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500 focus:ring-2"
              />
              <span className="text-sm text-slate-700">
                Don't warn me again for this session
              </span>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleRunAnyway}
              variant="primary"
              className="flex-1"
            >
              Run anyway
            </Button>
            <Button
              onClick={handleGoBack}
              variant="secondary"
              className="flex-1"
            >
              Go back
            </Button>
          </div>
        </div>
      </Modal>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Churn Reduction Simulator</h1>
        <p className="text-slate-600 text-lg">
          Simulate the impact of price changes on churn and find optimal pricing to reduce customer churn
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel - Inputs */}
        <div className="space-y-6">
          <Card title="Simulation Parameters">
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2.5">
                  Merchant
                </label>
                <Select
                  value={merchantId}
                  onChange={(e) => {
                    setMerchantId(e.target.value);
                    setPlanId("");
                    setNewPrice("");
                    setResult(null);
                    setPriceOptimization(null);
                    setAcknowledgedExtreme(false);
                  }}
                >
                  {dataset.merchants.map(merchant => (
                    <option key={merchant.id} value={merchant.id}>
                      {merchant.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2.5">
                  Plan
                </label>
                <Select
                  value={planId}
                  onChange={(e) => {
                    setPlanId(e.target.value);
                    setNewPrice("");
                    setResult(null);
                    setPriceOptimization(null);
                    setAcknowledgedExtreme(false);
                  }}
                >
                  <option value="">Select a plan</option>
                  {availablePlans.map(plan => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} ({plan.interval}) - {formatCurrency(plan.currentPriceMonthly)}/mo
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useGlobalBenchmarks}
                    onChange={(e) => {
                      setUseGlobalBenchmarks(e.target.checked);
                      setResult(null);
                      setPriceOptimization(null);
                      setAcknowledgedExtreme(false);
                    }}
                    className="w-4 h-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500 focus:ring-2"
                  />
                  <span className="text-sm font-semibold text-slate-700">
                    Use Global Benchmarks
                  </span>
                </label>
                <p className="text-xs text-slate-500 mt-1.5 ml-7">
                  Blend merchant-specific data with global benchmark data for more accurate predictions
                </p>
              </div>

              {selectedPlan && (
                <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl border border-slate-200/60 p-5">
                  <h4 className="font-semibold text-slate-900 mb-4 text-base">Plan Details</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center py-1.5 border-b border-slate-200/60 last:border-0">
                      <span className="text-slate-600 font-medium">Interval:</span>
                      <span className="font-semibold text-slate-900">{selectedPlan.interval}</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-slate-200/60 last:border-0">
                      <span className="text-slate-600 font-medium">Current Price:</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(selectedPlan.currentPriceMonthly)}/mo</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-slate-200/60 last:border-0">
                      <span className="text-slate-600 font-medium">Active Subs:</span>
                      <span className="font-semibold text-slate-900">{selectedPlan.activeSubs.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-slate-200/60 last:border-0">
                      <span className="text-slate-600 font-medium">Baseline Churn (90d):</span>
                      <span className="font-semibold text-slate-900">{formatPercent(selectedPlan.baselineChurn90d)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-slate-200/60 last:border-0">
                      <span className="text-slate-600 font-medium">Baseline MRR:</span>
                      <span className="font-semibold text-slate-900">{formatCurrency((selectedPlan.activeSubs * selectedPlan.currentPriceMonthly) + (selectedPlan.activeSubs * selectedPlan.arpuAddonsMonthly))}</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5">
                      <span className="text-slate-600 font-medium">Baseline ARR:</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(((selectedPlan.activeSubs * selectedPlan.currentPriceMonthly) + (selectedPlan.activeSubs * selectedPlan.arpuAddonsMonthly)) * 12)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2.5">
                  New Price (Monthly)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newPrice}
                  onChange={(e) => {
                    setNewPrice(e.target.value);
                    setResult(null);
                    setPriceOptimization(null);
                    setAcknowledgedExtreme(false);
                  }}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 hover:border-slate-400 placeholder:text-slate-400"
                  placeholder="Enter new price"
                />
              </div>

              <Button
                onClick={handleSimulate}
                disabled={!planId || !newPrice || !selectedPlan}
                className="w-full"
              >
                Run Simulation
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Panel - Results */}
        <div className="space-y-6">
          {/* Price Optimization Chart - Only shown after simulation runs */}
          {result && isCalculatingOptimal && (
            <Card title="Price Optimization">
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-2"></div>
                <p className="text-slate-600 text-sm">Calculating optimal price...</p>
              </div>
            </Card>
          )}
          {result && !isCalculatingOptimal && priceOptimization && chartDataWithChurnImpact.length > 0 && selectedPlan && (
            <Card title="Price Optimization for Churn Reduction">
              <div className="mb-6 pt-2 space-y-4">
                {/* Churn-Optimal Price */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl border border-blue-200/60 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-xs text-slate-600 font-semibold uppercase tracking-wide mb-1">Optimal Price for Churn Reduction</div>
                      <div className="text-2xl font-bold text-blue-700">
                        {formatCurrency(priceOptimization.optimalChurnPrice)}/mo
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-600 font-semibold uppercase tracking-wide mb-1">Expected Churn (90d)</div>
                      <div className="text-2xl font-bold text-blue-700">
                        {formatPercent(priceOptimization.optimalChurn90d)}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-slate-600 mt-2 pt-2 border-t border-blue-200/60">
                    ARR Impact: {formatCurrency(priceOptimization.optimalChurnARRImpact)} / year
                    {priceOptimization.optimalChurnPrice !== priceOptimization.currentPrice && (
                      <span className="ml-2">
                        (Current: {formatPercent(priceOptimization.currentChurn90d)} churn)
                      </span>
                    )}
                  </div>
                </div>

                {/* ARR-Optimal Price */}
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl border border-emerald-200/60 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-xs text-slate-600 font-semibold uppercase tracking-wide mb-1">Optimal Price for ARR Growth</div>
                      <div className="text-2xl font-bold text-emerald-700">
                        {formatCurrency(priceOptimization.optimalPrice)}/mo
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-600 font-semibold uppercase tracking-wide mb-1">Potential ARR Impact</div>
                      <div className={`text-2xl font-bold ${priceOptimization.optimalARRImpact >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {formatCurrency(priceOptimization.optimalARRImpact)}
                      </div>
                    </div>
                  </div>
                </div>

                {priceOptimization.optimalChurnPrice !== priceOptimization.currentPrice && (
                  <div className="text-sm text-slate-600 pt-2 border-t border-slate-200">
                    Current price: {formatCurrency(priceOptimization.currentPrice)}/mo 
                    ({formatPercent(priceOptimization.currentChurn90d)} churn, {formatCurrency(priceOptimization.currentARRImpact)} ARR impact)
                  </div>
                )}
              </div>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={chartDataWithChurnImpact}
                  margin={{ top: 40, right: 50, left: 60, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="price" 
                    tickFormatter={(value) => formatCurrency(value)}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    label={{ value: 'Plan Price', position: 'insideBottom', offset: -5, style: { textAnchor: 'middle', fill: '#64748b', fontSize: 12 } }}
                  />
                  <YAxis 
                    yAxisId="arr"
                    tickFormatter={(value) => formatCurrency(value)} 
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    label={{ value: 'ARR Impact', angle: -90, position: 'left', offset: 10, style: { textAnchor: 'middle', fill: '#64748b', fontSize: 12 } }}
                  />
                  <YAxis 
                    yAxisId="churn"
                    orientation="right"
                    tickFormatter={(value) => formatPercentChange(value)} 
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    label={{ value: 'Churn Impact', angle: 90, position: 'right', offset: 15, style: { textAnchor: 'middle', fill: '#64748b', fontSize: 12 } }}
                  />
                  <Tooltip content={<OptimizationTooltip />} />
                  <Line 
                    yAxisId="arr"
                    type="monotone" 
                    dataKey="arrImpact" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6, fill: '#3b82f6' }}
                    name="ARR Impact"
                  />
                  <Line 
                    yAxisId="churn"
                    type="monotone" 
                    dataKey="churnImpact" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6, fill: '#ef4444' }}
                    name="Churn Impact"
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                    iconType="line"
                    formatter={(value) => <span style={{ marginLeft: '8px' }}>{value}</span>}
                  />
                  {/* Current Price Reference Line */}
                  <ReferenceLine 
                    x={priceOptimization.currentPrice} 
                    stroke="#64748b" 
                    strokeDasharray="5 5"
                    label={{ value: "Current Price", position: "top", fill: "#64748b", fontSize: 11, offset: 10 }}
                  />
                  {/* Churn-Optimal Price Reference Line */}
                  {priceOptimization.optimalChurnPrice !== priceOptimization.currentPrice && (
                    <ReferenceLine 
                      x={priceOptimization.optimalChurnPrice} 
                      stroke="#3b82f6" 
                      strokeDasharray="5 5"
                      label={{ value: "Churn-Optimal", position: "top", fill: "#3b82f6", fontSize: 11, fontWeight: "bold", offset: 10 }}
                    />
                  )}
                  {/* ARR-Optimal Price Reference Line */}
                  {priceOptimization.optimalPrice !== priceOptimization.currentPrice && priceOptimization.optimalPrice !== priceOptimization.optimalChurnPrice && (
                    <ReferenceLine 
                      x={priceOptimization.optimalPrice} 
                      stroke="#10b981" 
                      strokeDasharray="5 5"
                      label={{ value: "ARR-Optimal", position: "top", fill: "#10b981", fontSize: 11, fontWeight: "bold", offset: 10 }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-6 pt-4 text-xs text-slate-500 border-t border-slate-200">
                This chart shows ARR impact (blue) and churn impact (red) across different price points. The churn-optimal price minimizes churn while maintaining reasonable ARR (within 10% loss). The ARR-optimal price maximizes revenue growth.
              </div>
            </Card>
          )}

          {!result ? (
            <Card>
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <p className="text-slate-600 mb-2 font-medium">No simulation run yet</p>
                <p className="text-sm text-slate-500">
                  Configure parameters on the left and click "Run Simulation" to see results
                </p>
              </div>
            </Card>
          ) : (
            <>
              {/* Churn Impact Card - Primary Focus */}
              <Card className={result.churnLift <= 0 ? "bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200/60" : "bg-gradient-to-br from-red-50 to-red-100/50 border-red-200/60"}>
                <div className="text-center">
                  <div className="text-sm text-slate-600 mb-2 font-semibold uppercase tracking-wide">Expected Churn Change (90d)</div>
                  <div className={`text-5xl font-bold mb-3 tracking-tight ${result.churnLift <= 0 ? "text-blue-700" : "text-red-700"}`}>
                    {formatPercentChange(result.churnLift)}
                  </div>
                  <div className="text-lg text-slate-600 mb-2">
                    Baseline: {formatPercent(result.baselineChurn90d)} → Expected: {formatPercent(result.expectedChurn90d)}
                  </div>
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Badge variant={result.confidence === "High" ? "success" : result.confidence === "Med" ? "warning" : "danger"}>
                      {result.confidence} Confidence
                    </Badge>
                    {result.usedHeuristic && (
                      <Badge variant="warning">Heuristic</Badge>
                    )}
                  </div>
                </div>
              </Card>

              {/* ARR Impact Card - Secondary */}
              <Card className={result.netARRDelta >= 0 ? "bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200/60" : "bg-gradient-to-br from-red-50 to-red-100/50 border-red-200/60"}>
                <div className="text-center">
                  <div className="text-sm text-slate-600 mb-2 font-semibold uppercase tracking-wide">Expected ARR Impact</div>
                  <div className={`text-4xl font-bold mb-3 tracking-tight ${result.netARRDelta >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {formatPercentChange(result.netARRDelta / (result.baselineMRR * 12))}
                  </div>
                  <div className={`text-xl font-semibold mb-4 ${result.netARRDelta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatCurrency(result.netARRDelta)} / year
                  </div>
                  <div className="text-sm text-slate-600 font-medium">
                    Range: {formatCurrency(result.rangeLow)} to {formatCurrency(result.rangeHigh)}
                  </div>
                </div>
              </Card>

              {/* Waterfall Chart */}
              <Card title="ARR Impact Breakdown (from Churn & Price Changes)">
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={waterfallData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                    />
                    <YAxis 
                      tickFormatter={(value) => formatCurrency(value)} 
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                    />
                    <Tooltip 
                      formatter={(value: number | undefined) => value !== undefined ? formatCurrency(value) : ''}
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e2e8f0', 
                        borderRadius: '8px',
                        boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.08)'
                      }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="value" fill="#8884d8" radius={[4, 4, 0, 0]}>
                      {waterfallData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            entry.type === 'baseline'
                              ? '#64748b'
                              : entry.type === 'uplift'
                              ? '#10b981'
                              : entry.type === 'churn'
                              ? '#ef4444'
                              : entry.type === 'net'
                              ? result.netARRDelta >= 0
                              ? '#10b981'
                              : '#ef4444'
                              : '#8884d8'
                          }
                        />
                      ))}
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              </Card>

              {/* Churn Comparison */}
              <Card title="Churn Impact Analysis">
                <div className="mb-5 space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-slate-200/60">
                    <span className="text-sm text-slate-600 font-medium">Baseline Churn (90d)</span>
                    <span className="font-semibold text-slate-900">{formatPercent(result.baselineChurn90d)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-200/60">
                    <span className="text-sm text-slate-600 font-medium">Expected Churn (90d)</span>
                    <span className="font-semibold text-slate-900">{formatPercent(result.expectedChurn90d)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-slate-600 font-medium">Churn Change</span>
                    <span className={`font-semibold ${result.churnLift >= 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {formatPercentChange(result.churnLift)}
                      {result.churnLift < 0 && (
                        <span className="ml-2 text-emerald-600">(Reduction)</span>
                      )}
                      {result.churnLift > 0 && (
                        <span className="ml-2 text-red-600">(Increase)</span>
                      )}
                    </span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={churnData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                    />
                    <YAxis 
                      tickFormatter={(value) => `${value}%`} 
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                    />
                    <Tooltip 
                      formatter={(value: number | undefined) => value !== undefined ? `${value.toFixed(1)}%` : ''}
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e2e8f0', 
                        borderRadius: '8px',
                        boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.08)'
                      }}
                    />
                    <Bar dataKey="churn" fill={result.churnLift <= 0 ? "#3b82f6" : "#ef4444"} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Evidence Table */}
              <Card title="Evidence">
                <div className="mb-4 text-sm text-slate-600 font-medium">
                  Based on {result.evidenceCount} comparable historical price changes
                </div>
                <div className="overflow-x-auto -mx-6 px-6">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Change</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Control</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Treatment</th>
                        {useGlobalBenchmarks && (
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Source</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {result.topComparableEvents.map((ce, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 text-sm text-slate-900">{formatDate(ce.event.effectiveDate)}</td>
                          <td className="px-4 py-3 text-sm text-slate-900 font-medium">{formatPercentChange(ce.event.pctChange)}</td>
                          <td className="px-4 py-3 text-sm text-slate-900">{formatPercent(ce.event.churn90dControl)}</td>
                          <td className="px-4 py-3 text-sm text-slate-900">{formatPercent(ce.event.churn90dTreatment)}</td>
                          {useGlobalBenchmarks && (
                            <td className="px-4 py-3 text-sm">
                              <Badge variant={ce.isGlobal ? "warning" : "success"}>
                                {ce.isGlobal ? "Global" : "Merchant"}
                              </Badge>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Assumptions */}
              <Card>
                <button
                  onClick={() => setShowAssumptions(!showAssumptions)}
                  className="w-full flex items-center justify-between text-left hover:opacity-80 transition-opacity"
                >
                  <h3 className="text-lg font-semibold text-slate-900">Assumptions</h3>
                  {showAssumptions ? <ChevronUp className="w-5 h-5 text-slate-600" /> : <ChevronDown className="w-5 h-5 text-slate-600" />}
                </button>
                {showAssumptions && (
                  <div className="mt-5 space-y-2.5 text-sm text-slate-600 pl-1">
                    <p className="flex items-start">
                      <span className="text-slate-400 mr-2">•</span>
                      <span>90-day churn window</span>
                    </p>
                    <p className="flex items-start">
                      <span className="text-slate-400 mr-2">•</span>
                      <span>Assumes price applies at renewal to existing subscribers</span>
                    </p>
                    <p className="flex items-start">
                      <span className="text-slate-400 mr-2">•</span>
                      <span>Assumes acquisition unchanged</span>
                    </p>
                    <p className="flex items-start">
                      <span className="text-slate-400 mr-2">•</span>
                      <span>Prototype: ML increases precision and scale later</span>
                    </p>
                    {result.usedHeuristic && (
                      <p className="text-amber-600 font-medium flex items-start">
                        <span className="text-amber-500 mr-2">•</span>
                        <span>Using heuristic fallback (insufficient comparable events)</span>
                      </p>
                    )}
                    {result.appliedPriceShock && result.priceShockNote && (
                      <p className="text-red-600 font-medium flex items-start">
                        <span className="text-red-500 mr-2">•</span>
                        <span>{result.priceShockNote}</span>
                      </p>
                    )}
                    {acknowledgedExtreme && (
                      <p className="text-amber-600 font-medium flex items-start">
                        <span className="text-amber-500 mr-2">•</span>
                        <span>Warning acknowledged: extreme price change; accuracy reduced.</span>
                      </p>
                    )}
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

