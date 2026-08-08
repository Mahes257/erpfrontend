import { useState } from 'react';
import { Flag, Loader2 } from 'lucide-react';
import { Modal, FormField, SelectInput } from '../Common';

const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'];

const PRIORITY_CHIPS = {
  High: 'bg-rose-50 text-rose-600 border border-rose-200',
  Medium: 'bg-amber-50 text-amber-600 border border-amber-200',
  Low: 'bg-sky-50 text-sky-600 border border-sky-200'
};

export default function ChangePriorityModal({ open, lead, onClose, onSubmit }) {
  const [priority, setPriority] = useState(lead?.priority || 'Medium');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!priority || submitting) return;
    setSubmitting(true);
    setError('');
    const ok = await onSubmit?.(priority);
    if (!ok) setSubmitting(false);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change Priority"
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
            disabled={!priority || submitting}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] hover:from-[#1d4ed8] hover:to-[#1e40af] disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flag className="w-3.5 h-3.5" />}
            Change Priority
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-violet-50 flex items-center justify-center text-violet-600 font-bold text-sm">
            {lead?.name?.slice(0, 1).toUpperCase() || '?'}
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">{lead?.name || 'Lead'}</div>
            <div className="text-[11px] text-slate-400 font-medium">{lead?.company || ''}</div>
          </div>
        </div>

        <FormField label="Priority" required error={error}>
          <SelectInput value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">Select a priority...</option>
            {PRIORITY_OPTIONS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </SelectInput>
        </FormField>

        {priority && (
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Preview</span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${PRIORITY_CHIPS[priority] || 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
              {priority}
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}
