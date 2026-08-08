import { useState } from 'react';
import { StickyNote, Loader2 } from 'lucide-react';
import { Modal, FormField, TextArea } from '../Common';

export default function AddNoteModal({ open, lead, onClose, onSubmit }) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    const value = text.trim();
    if (!value || submitting) return;
    setSubmitting(true);
    setError('');
    const ok = await onSubmit?.(value);
    if (!ok) setSubmitting(false);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Note"
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
            disabled={!text.trim() || submitting}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] hover:from-[#1d4ed8] hover:to-[#1e40af] disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <StickyNote className="w-3.5 h-3.5" />}
            Add Note
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 font-bold text-sm">
            {lead?.name?.slice(0, 1).toUpperCase() || '?'}
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">{lead?.name || 'Lead'}</div>
            <div className="text-[11px] text-slate-400 font-medium">{lead?.company || ''}</div>
          </div>
        </div>

        <FormField label="Note" required error={error}>
          <TextArea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Write a note about this lead..."
          />
        </FormField>
      </div>
    </Modal>
  );
}
