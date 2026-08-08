import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FollowUpForm } from '../components/FollowUpForm';
import { PageLoader } from '../components/Common';
import followUpService from '../services/followUpService';
import { normalizeFollowUp } from '../utils/followUpHelpers';

export default function EditFollowUp() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [initialData, setInitialData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    followUpService
      .getFollowUp(id)
      .then((response) => {
        if (cancelled) return;
        setInitialData(normalizeFollowUp(response?.data ?? response));
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Failed to load follow-up');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="flex-1 bg-app font-sans antialiased text-slate-800 p-4 sm:p-6 w-full max-w-[100vw] overflow-x-hidden">
      {loading ? (
        <PageLoader />
      ) : error ? (
        <div className="bg-surface border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-sm font-semibold text-rose-500">{error}</p>
          <button
            onClick={() => navigate('/followups')}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#0B4A3D] hover:bg-[#0a3f35] px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            Go to Follow-ups
          </button>
        </div>
      ) : (
        <FollowUpForm initialData={initialData} followUpId={Number(id)} />
      )}
    </div>
  );
}
