import { useState, useEffect } from 'react';
import {
  ShoppingBag, Plus, TrendingUp, Wallet,
  Truck, Star, ClipboardCheck, FileSpreadsheet, Users, FolderKanban,
  FileText, Receipt, Banknote, BadgeCheck, PackageCheck
} from 'lucide-react';
import api from '../api/axiosInstance';
import { formatINR } from '../utils/leadHelpers';

const METRIC_DEFS = [
  { id: 1, key: 'totalExpenses', title: 'Total Expenses', icon: ShoppingBag, color: 'text-pink-500', bg: 'bg-pink-50', currency: true },
  { id: 2, key: 'netProfit', title: 'Net Profit', icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50', currency: true },
  { id: 3, key: 'cashBalance', title: 'Cash Balance', icon: Wallet, color: 'text-teal-500', bg: 'bg-teal-50', currency: true },
  { id: 4, key: 'totalCustomers', title: 'Total Customers', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { id: 5, key: 'totalVendors', title: 'Total Vendors', icon: Truck, color: 'text-purple-500', bg: 'bg-purple-50' },
  { id: 6, key: 'activeLeads', title: 'Active Leads', icon: Star, color: 'text-amber-500', bg: 'bg-amber-50' },
  { id: 7, key: 'salesOrders', title: 'Sales Orders', icon: ShoppingBag, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { id: 8, key: 'purchaseOrders', title: 'Purchase Orders', icon: ClipboardCheck, color: 'text-amber-500', bg: 'bg-amber-50' },
  { id: 9, key: 'pendingDeliveries', title: 'Pending Deliveries', icon: Truck, color: 'text-pink-500', bg: 'bg-pink-50' },
  { id: 10, key: 'pendingReceipts', title: 'Pending Receipts', icon: FileSpreadsheet, color: 'text-orange-500', bg: 'bg-orange-50', currency: true },
  { id: 11, key: 'pendingPayments', title: 'Pending Payments', icon: Wallet, color: 'text-amber-600', bg: 'bg-amber-50', currency: true },
  { id: 12, key: 'pendingCprs', title: 'Pending CPRs', icon: FolderKanban, color: 'text-teal-600', bg: 'bg-teal-50' },
  { id: 13, key: 'totalQuotations', title: 'Quotations', icon: FileText, color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 14, key: 'totalSalesContracts', title: 'Sales Contracts', icon: BadgeCheck, color: 'text-indigo-500', bg: 'bg-indigo-50' },
  { id: 15, key: 'totalProformaInvoices', title: 'Proforma Invoices', icon: Receipt, color: 'text-cyan-500', bg: 'bg-cyan-50' },
  { id: 16, key: 'totalInvoices', title: 'Invoices', icon: FileSpreadsheet, color: 'text-violet-500', bg: 'bg-violet-50' },
  { id: 17, key: 'totalPaymentReceipts', title: 'Payment Receipts', icon: Banknote, color: 'text-rose-500', bg: 'bg-rose-50' },
  { id: 18, key: 'totalCreditNotes', title: 'Credit Notes', icon: Receipt, color: 'text-fuchsia-500', bg: 'bg-fuchsia-50' },
  { id: 19, key: 'totalDeliveryChallans', title: 'Delivery Challans', icon: PackageCheck, color: 'text-amber-600', bg: 'bg-amber-50' }
];

export default function Dashboard() {
  const [stats, setStats] = useState({});

  useEffect(() => {
    let cancelled = false;
    api
      .get('/dashboard/stats')
      .then(({ data }) => {
        if (!cancelled) setStats(data ?? {});
      })
      .catch(() => {
        if (!cancelled) setStats({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const metrics = METRIC_DEFS.map((def) => ({
    ...def,
    value: def.currency ? formatINR(stats[def.key] ?? 0) : String(stats[def.key] ?? 0)
  }));

  return (
    <>
      <div className="p-6 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-5">
              {metrics.map((item) => {
                const IconComponent = item.icon;
                return (
                  <div 
                    key={item.id} 
                    className="bg-surface border border-slate-200/80 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between min-h-[120px]"
                  >
                    {/* Top Line: Rounded Icon Signature */}
                    <div className="flex justify-between items-start">
                      <div className={`p-2.5 rounded-full ${item.bg} ${item.color}`}>
                        <IconComponent className="w-5 h-5" />
                      </div>
                    </div>

                    {/* Operational Numeric Data Stack Block */}
                    <div className="mt-3">
                      <div className="text-2xl font-bold text-slate-900 tracking-tight">
                        {item.value}
                      </div>
                      <div className="text-xs font-medium text-slate-400 mt-0.5">
                        {item.title}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* FLOATING ACTION INTERACTIVE CTA CONTROL BUTTON (+) */}
          <button className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors">
            <Plus className="w-5 h-5" />
          </button>
    </>
  );
}
