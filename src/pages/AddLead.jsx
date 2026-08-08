import { ChevronLeft, Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LeadForm from '../components/LeadForm';
import leadService from '../services/leadService';

export default function AddLead() {
  const navigate = useNavigate();
  const [initialData, setInitialData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    leadService
      .getNextNumber()
      .then((res) => {
        if (!cancelled && res?.data?.leadNo) {
          setInitialData({ leadNo: res.data.leadNo });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex-1 bg-app font-sans antialiased text-slate-800 p-4 sm:p-6 w-full max-w-[100vw] overflow-x-hidden">

      <div className="max-w-[1200px] mx-auto">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-[13px] text-slate-400 mb-2 select-none">
          <button onClick={() => navigate('/dashboard')} className="text-[#0B4A3D] hover:underline font-medium cursor-pointer">VISHAK TECH</button>
          <span className="text-[10px] text-slate-300">›</span>
          <button onClick={() => navigate('/leads')} className="text-[#0B4A3D] hover:underline font-medium cursor-pointer">Leads</button>
          <span className="text-[10px] text-slate-300">›</span>
          <span className="text-slate-600 font-medium">New Lead</span>
        </nav>

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5 m-0">Add New Lead</h1>
            <p className="text-[13px] text-slate-500 mt-1 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-slate-400" />
              Enter the details to register a new business lead.
            </p>
          </div>
          <button
            onClick={() => navigate('/leads')}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer select-none w-fit"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-slate-400" /> Back to Leads
          </button>
        </div>
      </div>

      <LeadForm initialData={initialData} />

    </div>
  );
}
