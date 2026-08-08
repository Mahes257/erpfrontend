import { useState, useEffect } from 'react';
import { UserCheck, Loader2 } from 'lucide-react';
import { Modal, FormField, SearchableSelect } from '../Common';
import leadService from '../../services/leadService';
import userService from '../../services/userService';

function normalizeUsers(data) {
  const list = Array.isArray(data) ? data : data?.data ?? data?.users ?? [];
  return list
    .map((user) => (typeof user === 'string' ? user : user?.name || user?.username || user?.email))
    .filter(Boolean);
}

export default function AssignOwnerModal({ open, lead, onClose, onSubmit }) {
  const [owner, setOwner] = useState(lead?.owner || '');
  const [users, setUsers] = useState(() => (lead?.owner ? [lead.owner] : []));
  const [submitting, setSubmitting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    leadService
      .getUsers()
      .then((data) => {
        if (!cancelled) {
          const normalized = normalizeUsers(data);
          if (normalized.length > 0) setUsers(normalized);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleSave = async () => {
    if (!owner || submitting) return;
    setSubmitting(true);
    setError('');
    const ok = await onSubmit?.(owner);
    if (!ok) setSubmitting(false);
  };

  // Create a brand-new owner in the database, then select it immediately.
  const handleCreateOwner = async (name) => {
    if (creating) return;
    setCreating(true);
    setError('');
    try {
      const created = await userService.createOwner(name);
      const ownerName = created?.name || name;
      setUsers((prev) => (prev.includes(ownerName) ? prev : [...prev, ownerName]));
      setOwner(ownerName);
    } catch (err) {
      setError(err?.message || 'Failed to create owner');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Assign Owner"
      footer={
        <>
          <button
            onClick={onClose}
            className="text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!owner || submitting}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] hover:from-[#1d4ed8] hover:to-[#1e40af] disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
            Assign Owner
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold text-sm">
            {lead?.name?.slice(0, 1).toUpperCase() || '?'}
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">{lead?.name || 'Lead'}</div>
            <div className="text-[11px] text-slate-400 font-medium">{lead?.company || ''}</div>
          </div>
        </div>

        <FormField label="Owner" required error={error}>
          <SearchableSelect
            value={owner}
            onChange={setOwner}
            creatable
            onCreate={handleCreateOwner}
            options={users.map((name) => ({ value: name, label: name }))}
            placeholder="Search and select an owner"
          />
        </FormField>
      </div>
    </Modal>
  );
}
