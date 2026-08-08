import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ClientForm } from '../components/ClientForm';
import { PageLoader } from '../components/Common';
import clientService from '../services/clientService';
import { normalizeClient } from '../utils/clientHelpers';

export default function EditClient() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await clientService.getClient(id);
        if (cancelled) return;
        setClient(normalizeClient(data?.data ?? data));
      } catch (err) {
        if (cancelled) return;
        setError(err?.message || 'Failed to load client');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
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
            onClick={() => navigate('/clients')}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] hover:from-[#1d4ed8] hover:to-[#1e40af] px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            Go to Clients
          </button>
        </div>
      ) : (
        <ClientForm key={client?.id} initialData={client} clientId={client?.id} />
      )}
    </div>
  );
}
