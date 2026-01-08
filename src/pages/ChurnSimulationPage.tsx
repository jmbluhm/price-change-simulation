import { useState, useMemo, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { dataset, TEST_MERCHANT_ID } from '../data/sampleData';
import { simulateChurn, type ChurnSimulationResult } from '../lib/simulateChurn';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { formatCurrency, formatPercent, formatNumber } from '../lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { InterventionType, IncentiveStrength } from '../data/types';

export function ChurnSimulationPage() {
  const [scope, setScope] = useState<"merchant" | "global">("merchant");
  const [merchantId, setMerchantId] = useState<string>(TEST_MERCHANT_ID);
  const [planId, setPlanId] = useState<string>("");
  
  // Lever A: Cancellation intervention
  const [interventionType, setInterventionType] = useState<InterventionType>("none");
  const [incentiveStrength, setIncentiveStrength] = useState<IncentiveStrength>("none");
  
  // Lever B: Dunning aggressiveness
  const [retries, setRetries] = useState<number>(3);
  const [retryWindowDays, setRetryWindowDays] = useState<number>(7);
  const [fallbackEnabled, setFallbackEnabled] = useState<boolean>(false);
  
  // Lever C: Pause policy
  const [pauseEnabled, setPauseEnabled] = useState<boolean>(false);
  const [maxPauseCycles, setMaxPauseCycles] = useState<number>(1);
  
  const [result, setResult] = useState<ChurnSimulationResult | null>(null);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [skipWarnings, setSkipWarnings] = useState(false);
  const [acknowledgedAggressive, setAcknowledgedAggressive] = useState(false);

  // Get available plans
  const availablePlans = useMemo(() => {
    if (scope === "merchant") {
      return dataset.plans.filter(p => p.merchantId === merchantId);
    }
    return dataset.plans;
  }, [scope, merchantId]);

  // Track previous availablePlans to detect changes
  const prevAvailablePlansRef = useRef(availablePlans);
  
  // Set default plan when merchant/scope changes
  useEffect(() => {
    const plansChanged = prevAvailablePlansRef.current !== availablePlans;
    if (plansChanged && availablePlans.length > 0) {
      const currentPlanExists = availablePlans.find(p => p.id === planId);
      if (!currentPlanExists) {
        queueMicrotask(() => {
          setPlanId(availablePlans[0].id);
          setResult(null);
        });
      }
      prevAvailablePlansRef.current = availablePlans;
    }
  }, [availablePlans, planId]);

  const selectedPlan = dataset.plans.find(p => p.id === planId);

  const runSimulation = () => {
    if (!planId || !selectedPlan) return;

    try {
      const simResult = simulateChurn({
        scope,
        merchantId: scope === "merchant" ? merchantId : undefined,
        planId,
        leverA: {
          type: interventionType,
          incentiveStrength: interventionType === "incentive" ? incentiveStrength : undefined,
        },
        leverB: {
          retries,
          retryWindowDays,
          fallbackEnabled,
        },
        leverC: {
          pauseEnabled,
          maxPauseCycles,
        },
      });
      setResult(simResult);
      if (acknowledgedAggressive) {
        setAcknowledgedAggressive(true);
      }
    } catch (error) {
      console.error("Simulation error:", error);
    }
  };

  const handleSimulate = () => {
    if (!planId || !selectedPlan) return;

    // Check if configuration is aggressive
    const isAggressive = 
      (interventionType === "incentive" && incentiveStrength === "heavy") ||
      retries >= 7 ||
      retryWindowDays >= 25 ||
      maxPauseCycles >= 5;

    if (!skipWarnings && isAggressive) {
      setShowWarning(true);
      return;
    }

    runSimulation();
  };

  const handleRunAnyway = () => {
    setShowWarning(false);
    setAcknowledgedAggressive(true);
    runSimulation();
  };

  const handleGoBack = () => {
    setShowWarning(false);
  };

  // Chart data: Baseline ARR lost vs ARR recovered
  const chartData = result && selectedPlan ? (() => {
    const expectedCancels = selectedPlan.activeSubs * selectedPlan.baselineCancelRate90d;
    const expectedPaymentFailures = selectedPlan.activeSubs * selectedPlan.paymentFailureRate90d;
    const expectedDunningLosses = expectedPaymentFailures * (1 - selectedPlan.baselineDunningRecoveryRate);
    const totalExpectedLosses = expectedCancels + expectedDunningLosses;
    const baselineARRLost = totalExpectedLosses * (selectedPlan.currentPriceMonthly + selectedPlan.arpuAddonsMonthly) * 12;
    
    return [
      { name: 'Baseline ARR Lost', value: baselineARRLost },
      { name: 'ARR Recovered', value: result.recoveredARR },
    ];
  })() : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Warning Modal */}
      <Modal
        open={showWarning}
        title="Aggressive Configuration Warning"
        onClose={handleGoBack}
      >
        <div className="space-y-4">
          <p className="text-slate-700">
            This configuration is unusually aggressive; estimated recovery may be overstated and could introduce customer experience risk.
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
        <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Churn Simulation</h1>
        <p className="text-slate-600 text-lg">
          Simulate the impact of retention interventions on recovered ARR
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel - Inputs */}
        <div className="space-y-6">
          <Card title="Simulation Parameters">
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2.5">
                  Scope
                </label>
                <Select
                  value={scope}
                  onChange={(e) => {
                    setScope(e.target.value as "merchant" | "global");
                    setResult(null);
                  }}
                >
                  <option value="merchant">Merchant</option>
                  <option value="global">Global</option>
                </Select>
              </div>

              {scope === "merchant" && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2.5">
                    Merchant
                  </label>
                  <Select
                    value={merchantId}
                    onChange={(e) => {
                      setMerchantId(e.target.value);
                      setPlanId("");
                      setResult(null);
                    }}
                  >
                    {dataset.merchants.map(merchant => (
                      <option key={merchant.id} value={merchant.id}>
                        {merchant.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2.5">
                  Plan
                </label>
                <Select
                  value={planId}
                  onChange={(e) => {
                    setPlanId(e.target.value);
                    setResult(null);
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

              {selectedPlan && (
                <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl border border-slate-200/60 p-5">
                  <h4 className="font-semibold text-slate-900 mb-4 text-base">Plan Details</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center py-1.5 border-b border-slate-200/60 last:border-0">
                      <span className="text-slate-600 font-medium">Active Subs:</span>
                      <span className="font-semibold text-slate-900">{selectedPlan.activeSubs.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-slate-200/60 last:border-0">
                      <span className="text-slate-600 font-medium">Baseline Cancel Rate (90d):</span>
                      <span className="font-semibold text-slate-900">{formatPercent(selectedPlan.baselineCancelRate90d)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-slate-200/60 last:border-0">
                      <span className="text-slate-600 font-medium">Payment Failure Rate (90d):</span>
                      <span className="font-semibold text-slate-900">{formatPercent(selectedPlan.paymentFailureRate90d)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5">
                      <span className="text-slate-600 font-medium">Baseline Recovery Rate:</span>
                      <span className="font-semibold text-slate-900">{formatPercent(selectedPlan.baselineDunningRecoveryRate)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Lever A: Cancellation Intervention */}
              <div className="pt-4 border-t border-slate-200">
                <h4 className="text-base font-semibold text-slate-900 mb-4">Lever A: Cancellation Intervention</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2.5">
                      Intervention Type
                    </label>
                    <Select
                      value={interventionType}
                      onChange={(e) => {
                        setInterventionType(e.target.value as InterventionType);
                        if (e.target.value !== "incentive") {
                          setIncentiveStrength("none");
                        }
                        setResult(null);
                      }}
                    >
                      <option value="none">None</option>
                      <option value="survey">Survey</option>
                      <option value="pause">Pause</option>
                      <option value="incentive">Incentive</option>
                    </Select>
                  </div>
                  {interventionType === "incentive" && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2.5">
                        Incentive Strength
                      </label>
                      <Select
                        value={incentiveStrength}
                        onChange={(e) => {
                          setIncentiveStrength(e.target.value as IncentiveStrength);
                          setResult(null);
                        }}
                      >
                        <option value="light">Light</option>
                        <option value="medium">Medium</option>
                        <option value="heavy">Heavy</option>
                      </Select>
                    </div>
                  )}
                </div>
              </div>

              {/* Lever B: Dunning Aggressiveness */}
              <div className="pt-4 border-t border-slate-200">
                <h4 className="text-base font-semibold text-slate-900 mb-4">Lever B: Dunning Aggressiveness</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2.5">
                      Retries: {retries}
                    </label>
                    <input
                      type="range"
                      min="3"
                      max="8"
                      value={retries}
                      onChange={(e) => {
                        setRetries(parseInt(e.target.value));
                        setResult(null);
                      }}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>3</span>
                      <span>8</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2.5">
                      Retry Window (Days): {retryWindowDays}
                    </label>
                    <input
                      type="range"
                      min="7"
                      max="30"
                      value={retryWindowDays}
                      onChange={(e) => {
                        setRetryWindowDays(parseInt(e.target.value));
                        setResult(null);
                      }}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>7</span>
                      <span>30</span>
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={fallbackEnabled}
                        onChange={(e) => {
                          setFallbackEnabled(e.target.checked);
                          setResult(null);
                        }}
                        className="w-4 h-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500 focus:ring-2"
                      />
                      <span className="text-sm font-semibold text-slate-700">
                        Fallback Enabled
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Lever C: Pause Policy */}
              <div className="pt-4 border-t border-slate-200">
                <h4 className="text-base font-semibold text-slate-900 mb-4">Lever C: Pause Policy</h4>
                <div className="space-y-4">
                  <div>
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pauseEnabled}
                        onChange={(e) => {
                          setPauseEnabled(e.target.checked);
                          setResult(null);
                        }}
                        className="w-4 h-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500 focus:ring-2"
                      />
                      <span className="text-sm font-semibold text-slate-700">
                        Pause Enabled
                      </span>
                    </label>
                  </div>
                  {pauseEnabled && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2.5">
                        Max Pause Cycles: {maxPauseCycles}
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="6"
                        value={maxPauseCycles}
                        onChange={(e) => {
                          setMaxPauseCycles(parseInt(e.target.value));
                          setResult(null);
                        }}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>1</span>
                        <span>6</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Button
                onClick={handleSimulate}
                disabled={!planId || !selectedPlan}
                className="w-full"
              >
                Run Simulation
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Panel - Results */}
        <div className="space-y-6">
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
              {/* Recovered ARR Card - Primary */}
              <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200/60">
                <div className="text-center">
                  <div className="text-sm text-slate-600 mb-2 font-semibold uppercase tracking-wide">Recovered ARR</div>
                  <div className="text-5xl font-bold mb-3 tracking-tight text-emerald-700">
                    {formatCurrency(result.recoveredARR)} / year
                  </div>
                  <div className="text-lg text-slate-600 mb-2">
                    Range: {formatCurrency(result.rangeLow)} to {formatCurrency(result.rangeHigh)}
                  </div>
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Badge variant={result.confidence === "High" ? "success" : result.confidence === "Med" ? "warning" : "danger"}>
                      {result.confidence} Confidence
                    </Badge>
                  </div>
                </div>
              </Card>

              {/* Supporting Metrics */}
              <Card title="Supporting Metrics">
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-slate-200/60">
                    <span className="text-sm text-slate-600 font-medium">Saved Subscriptions:</span>
                    <span className="font-semibold text-slate-900">{formatNumber(Math.round(result.savedSubs))}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-200/60">
                    <span className="text-sm text-slate-600 font-medium">Recovered MRR:</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(result.recoveredMRR)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-200/60">
                    <span className="text-sm text-slate-600 font-medium">Churn Reduction (pp):</span>
                    <span className="font-semibold text-slate-900">{result.churnReductionPp.toFixed(2)}pp</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-slate-600 font-medium">Fatigue Factor Applied:</span>
                    <span className="font-semibold text-slate-900">{formatPercent(result.fatigueFactor)}</span>
                  </div>
                </div>
              </Card>

              {/* Evidence Card */}
              <Card title="Evidence">
                <div className="mb-4 text-sm text-slate-600 font-medium">
                  Comparable event counts used in simulation
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-slate-200/60">
                    <span className="text-sm text-slate-600 font-medium">Cancellation Events:</span>
                    <span className="font-semibold text-slate-900">{result.evidence.comparableCancellationEvents.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-200/60">
                    <span className="text-sm text-slate-600 font-medium">Payment Failure Events:</span>
                    <span className="font-semibold text-slate-900">{result.evidence.comparablePaymentEvents.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-slate-600 font-medium">Pause Events:</span>
                    <span className="font-semibold text-slate-900">{result.evidence.comparablePauseEvents.toLocaleString()}</span>
                  </div>
                </div>
              </Card>

              {/* Chart */}
              <Card title="ARR Impact Comparison">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
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
                    <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <Card className="bg-amber-50 border-amber-200/60">
                  <h3 className="text-lg font-semibold text-amber-900 mb-3">Warnings</h3>
                  <div className="space-y-2">
                    {result.warnings.map((warning, idx) => (
                      <p key={idx} className="text-sm text-amber-800">
                        {warning}
                      </p>
                    ))}
                  </div>
                </Card>
              )}

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
                      <span>90-day window</span>
                    </p>
                    <p className="flex items-start">
                      <span className="text-slate-400 mr-2">•</span>
                      <span>No acquisition effects</span>
                    </p>
                    <p className="flex items-start">
                      <span className="text-slate-400 mr-2">•</span>
                      <span>Prototype math</span>
                    </p>
                    {acknowledgedAggressive && (
                      <p className="text-amber-600 font-medium flex items-start">
                        <span className="text-amber-500 mr-2">•</span>
                        <span>Warning acknowledged: aggressive configuration; accuracy may be reduced.</span>
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
