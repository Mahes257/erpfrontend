import { useState } from 'react';
import { CalendarClock, Loader2 } from 'lucide-react';
import { Modal, FormField, TextArea } from '../Common';
import { formatDate } from '../../utils/followUpHelpers';

export default function RescheduleModal({ open, followUp, onClose, onSubmit }) {
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpTime, setFollowUpTime] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevFollowUp, setPrevFollowUp] = useState(followUp);

  const canSubmit = Boolean(followUpDate) && !submitting;

  if (open !== prevOpen || followUp !== prevFollowUp) {
    setPrevOpen(open);
    setPrevFollowUp(followUp);
    setFollowUpDate(followUp?.followUpDate || '');
    setFollowUpTime(followUp?.followUpTime || '');
    setNotes(followUp?.remarks || '');
    setError('');
  }

  const handleSave = async () => {
    if (!followUpDate || submitting) return;
    setSubmitting(true);
    setError('');
    const ok = await onSubmit?.({ followUpDate, followUpTime, remarks: notes });
    if (!ok) setSubmitting(false);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reschedule Follow-up"
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
            disabled={!canSubmit}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] hover:from-[#1d4ed8] hover:to-[#1e40af] disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarClock className="w-3.5 h-3.5" />}
            Reschedule
          </button>
        </>
      }
      closeOnBackdrop={false}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
            <CalendarClock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-900 truncate">{followUp?.followUpNo || 'Follow-up'}</div>
            <div className="text-[11px] font-medium text-slate-400 truncate">
              {followUp?.leadName || ''}{followUp?.leadCompany ? ` · ${followUp.leadCompany}` : ''}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="New Date" required error={error}>
            <input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-500/60"
            />
          </FormField>
          <FormField label="Time">
            <input
              type="time"
              value={followUpTime}
              onChange={(e) => setFollowUpTime(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-500/60"
            />
          </FormField>
        </div>

        <FormField label="Notes">
          <TextArea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Add a note about the reschedule..."
          />
        </FormField>

        {followUp?.followUpDate && (
          <p className="text-[11px] font-medium text-slate-400">
            Currently scheduled for <span className="font-bold text-slate-600">{formatDate(followUp.followUpDate)}</span>
            {followUp.followUpTime ? ` at ${followUp.followUpTime}` : ''}.
          </p>
        )}
      </div>
    </Modal>
  );
}
