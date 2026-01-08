import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import { dataset } from '../data/sampleData';
import { Card } from '../components/ui/Card';
import { Select } from '../components/ui/Select';
import { formatCurrency, formatPercent, formatPercentChange, formatDate, formatNumber } from '../lib/utils';
import type { Merchant, Plan, PriceChangeEvent, CancellationEvent, PaymentFailureEvent, PauseEvent } from '../data/types';

type Scope = 'global' | 'merchant';

  const columnHelper = createColumnHelper<Merchant>();
  const planColumnHelper = createColumnHelper<Plan>();
  const eventColumnHelper = createColumnHelper<PriceChangeEvent>();
  const cancellationColumnHelper = createColumnHelper<CancellationEvent>();
  const paymentColumnHelper = createColumnHelper<PaymentFailureEvent>();
  const pauseColumnHelper = createColumnHelper<PauseEvent>();

export function DataPage() {
  const [scope, setScope] = useState<Scope>('global');
  const [selectedMerchantId, setSelectedMerchantId] = useState<string>(dataset.merchants[0]?.id || '');
  const [merchantSorting, setMerchantSorting] = useState<SortingState>([]);
  const [planSorting, setPlanSorting] = useState<SortingState>([]);
  const [eventSorting, setEventSorting] = useState<SortingState>([]);
  const [cancellationSorting, setCancellationSorting] = useState<SortingState>([]);
  const [paymentSorting, setPaymentSorting] = useState<SortingState>([]);
  const [pauseSorting, setPauseSorting] = useState<SortingState>([]);
  const [merchantFilters, setMerchantFilters] = useState<ColumnFiltersState>([]);
  const [planFilters, setPlanFilters] = useState<ColumnFiltersState>([]);
  const [eventFilters, setEventFilters] = useState<ColumnFiltersState>([]);
  const [cancellationFilters, setCancellationFilters] = useState<ColumnFiltersState>([]);
  const [paymentFilters, setPaymentFilters] = useState<ColumnFiltersState>([]);
  const [pauseFilters, setPauseFilters] = useState<ColumnFiltersState>([]);

  // Filter data based on scope
  const filteredMerchants = useMemo(() => {
    if (scope === 'merchant') {
      return dataset.merchants.filter(m => m.id === selectedMerchantId);
    }
    return dataset.merchants;
  }, [scope, selectedMerchantId]);

  const filteredPlans = useMemo(() => {
    if (scope === 'merchant') {
      return dataset.plans.filter(p => p.merchantId === selectedMerchantId);
    }
    return dataset.plans;
  }, [scope, selectedMerchantId]);

  const filteredEvents = useMemo(() => {
    if (scope === 'merchant') {
      return dataset.events.filter(e => e.merchantId === selectedMerchantId);
    }
    return dataset.events;
  }, [scope, selectedMerchantId]);

  const filteredCancellationEvents = useMemo(() => {
    if (scope === 'merchant') {
      return dataset.cancellationEvents.filter(e => e.merchantId === selectedMerchantId);
    }
    return dataset.cancellationEvents;
  }, [scope, selectedMerchantId]);

  const filteredPaymentEvents = useMemo(() => {
    if (scope === 'merchant') {
      return dataset.paymentFailureEvents.filter(e => e.merchantId === selectedMerchantId);
    }
    return dataset.paymentFailureEvents;
  }, [scope, selectedMerchantId]);

  const filteredPauseEvents = useMemo(() => {
    if (scope === 'merchant') {
      return dataset.pauseEvents.filter(e => e.merchantId === selectedMerchantId);
    }
    return dataset.pauseEvents;
  }, [scope, selectedMerchantId]);

  // Merchant columns
  const merchantColumns = useMemo(
    () => [
      columnHelper.accessor('id', {
        header: 'ID',
        cell: info => info.getValue(),
      }),
      columnHelper.accessor('name', {
        header: 'Name',
        cell: info => info.getValue(),
      }),
      columnHelper.accessor('vertical', {
        header: 'Vertical',
        cell: info => info.getValue(),
      }),
    ],
    []
  );

  // Plan columns
  const planColumns = useMemo(
    () => [
      planColumnHelper.accessor('id', {
        header: 'ID',
        cell: info => info.getValue(),
      }),
      planColumnHelper.accessor('merchantId', {
        header: 'Merchant ID',
        cell: info => {
          const merchant = dataset.merchants.find(m => m.id === info.getValue());
          return merchant?.name || info.getValue();
        },
      }),
      planColumnHelper.accessor('name', {
        header: 'Plan Name',
        cell: info => info.getValue(),
      }),
      planColumnHelper.accessor('interval', {
        header: 'Interval',
        cell: info => info.getValue(),
      }),
      planColumnHelper.accessor('currentPriceMonthly', {
        header: 'Price (Monthly)',
        cell: info => formatCurrency(info.getValue()),
      }),
      planColumnHelper.accessor('activeSubs', {
        header: 'Active Subs',
        cell: info => formatNumber(info.getValue()),
      }),
      planColumnHelper.accessor('baselineChurn90d', {
        header: 'Baseline Churn (90d)',
        cell: info => formatPercent(info.getValue()),
      }),
      planColumnHelper.accessor('arpuAddonsMonthly', {
        header: 'Addon ARPU',
        cell: info => formatCurrency(info.getValue()),
      }),
    ],
    []
  );

  // Event columns
  const eventColumns = useMemo(
    () => [
      eventColumnHelper.accessor('id', {
        header: 'ID',
        cell: info => info.getValue(),
      }),
      eventColumnHelper.accessor('merchantId', {
        header: 'Merchant',
        cell: info => {
          const merchant = dataset.merchants.find(m => m.id === info.getValue());
          return merchant?.name || info.getValue();
        },
      }),
      eventColumnHelper.accessor('planId', {
        header: 'Plan',
        cell: info => {
          const plan = dataset.plans.find(p => p.id === info.getValue());
          return plan?.name || info.getValue();
        },
      }),
      eventColumnHelper.accessor('effectiveDate', {
        header: 'Date',
        cell: info => formatDate(info.getValue()),
      }),
      eventColumnHelper.accessor('oldPriceMonthly', {
        header: 'Old Price',
        cell: info => formatCurrency(info.getValue()),
      }),
      eventColumnHelper.accessor('newPriceMonthly', {
        header: 'New Price',
        cell: info => formatCurrency(info.getValue()),
      }),
      eventColumnHelper.accessor('pctChange', {
        header: 'Change',
        cell: info => formatPercentChange(info.getValue()),
      }),
      eventColumnHelper.accessor('churn90dControl', {
        header: 'Control Churn',
        cell: info => formatPercent(info.getValue()),
      }),
      eventColumnHelper.accessor('churn90dTreatment', {
        header: 'Treatment Churn',
        cell: info => formatPercent(info.getValue()),
      }),
      eventColumnHelper.accessor('notes', {
        header: 'Notes',
        cell: info => info.getValue() || '-',
      }),
    ],
    []
  );

  // Cancellation event columns
  const cancellationColumns = useMemo(
    () => [
      cancellationColumnHelper.accessor('id', {
        header: 'ID',
        cell: info => info.getValue(),
      }),
      cancellationColumnHelper.accessor('merchantId', {
        header: 'Merchant',
        cell: info => {
          const merchant = dataset.merchants.find(m => m.id === info.getValue());
          return merchant?.name || info.getValue();
        },
      }),
      cancellationColumnHelper.accessor('planId', {
        header: 'Plan',
        cell: info => {
          const plan = dataset.plans.find(p => p.id === info.getValue());
          return plan?.name || info.getValue();
        },
      }),
      cancellationColumnHelper.accessor('eventDate', {
        header: 'Date',
        cell: info => formatDate(info.getValue()),
      }),
      cancellationColumnHelper.accessor('interventionType', {
        header: 'Intervention',
        cell: info => info.getValue(),
      }),
      cancellationColumnHelper.accessor('incentiveStrength', {
        header: 'Incentive',
        cell: info => info.getValue() || '-',
      }),
      cancellationColumnHelper.accessor('outcome', {
        header: 'Outcome',
        cell: info => info.getValue(),
      }),
      cancellationColumnHelper.accessor('postEventLifetimeDays', {
        header: 'Lifetime Days',
        cell: info => {
          const value = info.getValue();
          return value !== undefined ? formatNumber(value) : '-';
        },
      }),
    ],
    []
  );

  // Payment failure event columns
  const paymentColumns = useMemo(
    () => [
      paymentColumnHelper.accessor('id', {
        header: 'ID',
        cell: info => info.getValue(),
      }),
      paymentColumnHelper.accessor('merchantId', {
        header: 'Merchant',
        cell: info => {
          const merchant = dataset.merchants.find(m => m.id === info.getValue());
          return merchant?.name || info.getValue();
        },
      }),
      paymentColumnHelper.accessor('planId', {
        header: 'Plan',
        cell: info => {
          const plan = dataset.plans.find(p => p.id === info.getValue());
          return plan?.name || info.getValue();
        },
      }),
      paymentColumnHelper.accessor('eventDate', {
        header: 'Date',
        cell: info => formatDate(info.getValue()),
      }),
      paymentColumnHelper.accessor('retries', {
        header: 'Retries',
        cell: info => info.getValue(),
      }),
      paymentColumnHelper.accessor('retryWindowDays', {
        header: 'Window (Days)',
        cell: info => info.getValue(),
      }),
      paymentColumnHelper.accessor('fallbackEnabled', {
        header: 'Fallback',
        cell: info => info.getValue() ? 'Yes' : 'No',
      }),
      paymentColumnHelper.accessor('recovered', {
        header: 'Recovered',
        cell: info => info.getValue() ? 'Yes' : 'No',
      }),
      paymentColumnHelper.accessor('recoveryDays', {
        header: 'Recovery Days',
        cell: info => {
          const value = info.getValue();
          return value !== undefined ? formatNumber(value) : '-';
        },
      }),
    ],
    []
  );

  // Pause event columns
  const pauseColumns = useMemo(
    () => [
      pauseColumnHelper.accessor('id', {
        header: 'ID',
        cell: info => info.getValue(),
      }),
      pauseColumnHelper.accessor('merchantId', {
        header: 'Merchant',
        cell: info => {
          const merchant = dataset.merchants.find(m => m.id === info.getValue());
          return merchant?.name || info.getValue();
        },
      }),
      pauseColumnHelper.accessor('planId', {
        header: 'Plan',
        cell: info => {
          const plan = dataset.plans.find(p => p.id === info.getValue());
          return plan?.name || info.getValue();
        },
      }),
      pauseColumnHelper.accessor('eventDate', {
        header: 'Date',
        cell: info => formatDate(info.getValue()),
      }),
      pauseColumnHelper.accessor('pauseEnabled', {
        header: 'Pause Enabled',
        cell: info => info.getValue() ? 'Yes' : 'No',
      }),
      pauseColumnHelper.accessor('pauseCycles', {
        header: 'Cycles',
        cell: info => info.getValue(),
      }),
      pauseColumnHelper.accessor('resumed', {
        header: 'Resumed',
        cell: info => info.getValue() ? 'Yes' : 'No',
      }),
      pauseColumnHelper.accessor('churnedWithin90d', {
        header: 'Churned (90d)',
        cell: info => info.getValue() === undefined ? '-' : (info.getValue() ? 'Yes' : 'No'),
      }),
    ],
    []
  );

  const merchantTable = useReactTable({
    data: filteredMerchants,
    columns: merchantColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting: merchantSorting,
      columnFilters: merchantFilters,
    },
    onSortingChange: setMerchantSorting,
    onColumnFiltersChange: setMerchantFilters,
  });

  const planTable = useReactTable({
    data: filteredPlans,
    columns: planColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting: planSorting,
      columnFilters: planFilters,
    },
    onSortingChange: setPlanSorting,
    onColumnFiltersChange: setPlanFilters,
  });

  const eventTable = useReactTable({
    data: filteredEvents,
    columns: eventColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting: eventSorting,
      columnFilters: eventFilters,
    },
    onSortingChange: setEventSorting,
    onColumnFiltersChange: setEventFilters,
  });

  const cancellationTable = useReactTable({
    data: filteredCancellationEvents,
    columns: cancellationColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting: cancellationSorting,
      columnFilters: cancellationFilters,
    },
    onSortingChange: setCancellationSorting,
    onColumnFiltersChange: setCancellationFilters,
  });

  const paymentTable = useReactTable({
    data: filteredPaymentEvents,
    columns: paymentColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting: paymentSorting,
      columnFilters: paymentFilters,
    },
    onSortingChange: setPaymentSorting,
    onColumnFiltersChange: setPaymentFilters,
  });

  const pauseTable = useReactTable({
    data: filteredPauseEvents,
    columns: pauseColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting: pauseSorting,
      columnFilters: pauseFilters,
    },
    onSortingChange: setPauseSorting,
    onColumnFiltersChange: setPauseFilters,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Sample Data</h1>
        <p className="text-slate-600 text-lg">
          View merchants, plans, and historical price change events
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row gap-5">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-slate-700 mb-2.5">
              Scope
            </label>
            <Select
              value={scope}
              onChange={(e) => {
                setScope(e.target.value as Scope);
                if (e.target.value === 'merchant' && !selectedMerchantId) {
                  setSelectedMerchantId(dataset.merchants[0]?.id || '');
                }
              }}
            >
              <option value="global">Global</option>
              <option value="merchant">Merchant</option>
            </Select>
          </div>
          {scope === 'merchant' && (
            <div className="flex-1">
              <label className="block text-sm font-semibold text-slate-700 mb-2.5">
                Merchant
              </label>
              <Select
                value={selectedMerchantId}
                onChange={(e) => setSelectedMerchantId(e.target.value)}
              >
                {dataset.merchants.map(merchant => (
                  <option key={merchant.id} value={merchant.id}>
                    {merchant.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-5 mb-6">
        <Card>
          <div className="text-sm text-slate-600 font-medium mb-1.5">Total Merchants</div>
          <div className="text-3xl font-bold text-slate-900 tracking-tight">{filteredMerchants.length}</div>
        </Card>
        <Card>
          <div className="text-sm text-slate-600 font-medium mb-1.5">Total Plans</div>
          <div className="text-3xl font-bold text-slate-900 tracking-tight">{filteredPlans.length}</div>
        </Card>
        <Card>
          <div className="text-sm text-slate-600 font-medium mb-1.5">Price Events</div>
          <div className="text-3xl font-bold text-slate-900 tracking-tight">{filteredEvents.length}</div>
        </Card>
        <Card>
          <div className="text-sm text-slate-600 font-medium mb-1.5">Cancellation Events</div>
          <div className="text-3xl font-bold text-slate-900 tracking-tight">{filteredCancellationEvents.length}</div>
        </Card>
        <Card>
          <div className="text-sm text-slate-600 font-medium mb-1.5">Payment Events</div>
          <div className="text-3xl font-bold text-slate-900 tracking-tight">{filteredPaymentEvents.length}</div>
        </Card>
        <Card>
          <div className="text-sm text-slate-600 font-medium mb-1.5">Pause Events</div>
          <div className="text-3xl font-bold text-slate-900 tracking-tight">{filteredPauseEvents.length}</div>
        </Card>
      </div>

      {/* Merchants Table */}
      <Card title="Merchants" className="mb-6">
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              {merchantTable.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      className="px-6 py-3.5 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider cursor-pointer hover:bg-slate-100/80 transition-colors"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-2">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() && (
                          <span className="text-primary-600">
                            {header.column.getIsSorted() === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {merchantTable.getRowModel().rows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Plans Table */}
      <Card title="Plans" className="mb-6">
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              {planTable.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      className="px-6 py-3.5 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider cursor-pointer hover:bg-slate-100/80 transition-colors"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-2">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() && (
                          <span className="text-primary-600">
                            {header.column.getIsSorted() === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {planTable.getRowModel().rows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Events Table */}
      <Card title="Price Change Events" className="mb-6">
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              {eventTable.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      className="px-6 py-3.5 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider cursor-pointer hover:bg-slate-100/80 transition-colors"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-2">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() && (
                          <span className="text-primary-600">
                            {header.column.getIsSorted() === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {eventTable.getRowModel().rows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Cancellation Events Table */}
      <Card title="Cancellation Events" className="mb-6">
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              {cancellationTable.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      className="px-6 py-3.5 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider cursor-pointer hover:bg-slate-100/80 transition-colors"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-2">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() && (
                          <span className="text-primary-600">
                            {header.column.getIsSorted() === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {cancellationTable.getRowModel().rows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Payment Failure Events Table */}
      <Card title="Payment Failure Events" className="mb-6">
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              {paymentTable.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      className="px-6 py-3.5 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider cursor-pointer hover:bg-slate-100/80 transition-colors"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-2">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() && (
                          <span className="text-primary-600">
                            {header.column.getIsSorted() === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {paymentTable.getRowModel().rows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pause Events Table */}
      <Card title="Pause Events">
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              {pauseTable.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      className="px-6 py-3.5 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider cursor-pointer hover:bg-slate-100/80 transition-colors"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-2">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() && (
                          <span className="text-primary-600">
                            {header.column.getIsSorted() === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {pauseTable.getRowModel().rows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

