import { useMemo, useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { ClientForm } from '../components/ClientForm';
import { PageLoader } from '../components/Common';
import clientService from '../services/clientService';

function buildClientPrefill(lead) {
  if (!lead) return undefined;
  return {
    clientNo: lead.clientNo || '',
    name: lead.name || '',
    company: lead.company || lead.businessName || '',
    designation: lead.title || '',
    email: lead.email || '',
    phone: lead.phone || '',
    website: lead.website || '',
    value: lead.value && lead.value !== 0 ? String(lead.value) : '',
    owner: lead.owner || 'Admin User',
    industry: lead.industry || lead.businessType || '',
    taxId: lead.taxId || '',
    gstin: lead.gstin || '',
    panNumber: lead.panNumber || '',
    clientType: lead.clientType || '',
    taxTreatment: lead.taxTreatment || '',
    address: lead.address || '',
    city: lead.city || '',
    state: lead.state || '',
    pincode: lead.pincode || '',
    country: lead.country || 'India',
    alias: lead.alias || '',
    mapNo: lead.mapNo || '',
    category: lead.category || '',
    paymentTerms: lead.paymentTerms || '',
    creditLimit: lead.creditLimit ? String(lead.creditLimit) : '',
    currency: lead.currency || 'INR',
    internalNotes: typeof lead.internalNotes === 'string' ? lead.internalNotes : ''
  };
}

export default function AddClient() {
  const location = useLocation();
  const lead = location.state?.lead;
  const [nextClientNo, setNextClientNo] = useState('');
  const [loaded, setLoaded] = useState(false);
  const fetched = useRef(false);

  // Auto-fill the next client number from the existing numbering
  // infrastructure (CLIENT sequence). Editable before save. The form is
  // only rendered once the number has arrived, because react-hook-form
  // reads defaultValues on mount only.
  useEffect(() => {
    // The ref dedupes the StrictMode double-effect so the sequence is
    // only consumed once; no cleanup flag needed (React 18 no longer
    // warns about setState after unmount).
    if (fetched.current) return;
    fetched.current = true;
    clientService
      .getNextNumber()
      .then((res) => setNextClientNo(res?.clientNo || ''))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const prefill = useMemo(() => {
    const base = buildClientPrefill(lead);
    return { ...base, clientNo: base?.clientNo || nextClientNo || '' };
  }, [lead, nextClientNo]);

  return (
    <div className="flex-1 bg-app font-sans antialiased text-slate-800 p-4 sm:p-6 w-full max-w-[100vw] overflow-x-hidden">
      {loaded ? <ClientForm initialData={prefill} /> : <PageLoader />}
    </div>
  );
}
