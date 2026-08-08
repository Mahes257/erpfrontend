import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Plus, CalendarClock, Pencil, CheckCircle2,
  XCircle, Trash2, Loader2, PhoneCall, Mail, Users,
  MessageCircle, MapPin, ClipboardList
} from 'lucide-react';
import leadService from '../../services/leadService';
import useAsyncData from '../../hooks/useAsyncData';
import DetailSection from './DetailSection';
import ScheduleFollowUpModal from './ScheduleFollowUpModal';
import { useToast, ConfirmDialog } from '../Common';
import { formatDate } from '../../utils/leadHelpers';

const MODE_ICONS = {
  Call: PhoneCall,
  Email: Mail,
  Meeting: Users,
  WhatsApp: MessageCircle,
  Visit: MapPin,
  Other: ClipboardList,
  default: CalendarClock
};

const MODE_COLORS = {
  Call: 'bg-sky-50 text-sky-600',
  Email: 'bg-indigo-50 text-indigo-600',
  Meeting: 'bg-purple-50 text-purple-600',
  WhatsApp: 'bg-emerald-50 text-emerald-600',
  Visit: 'bg-amber-50 text-amber-600',
  Other: 'bg-slate-100 text-slate-500',
  default: 'bg-slate-100 text-slate-500'
};

const STATUS_CHIPS = {
  Draft: 'bg-slate-100 text-slate-500 border border-slate-200',
  Pending: 'bg-amber-50 text-amber-600 border border-amber-100',
  Completed: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
  Cancelled: 'bg-slate-100 text-slate-500 border border-slate-200'
};

const PRIORITY_CHIPS = {
  High: 'bg-rose-50 text-rose-600 border border-rose-100',
  Medium: 'bg-amber-50 text-amber-600 border border-amber-100',
  Low: 'bg-emerald-50 text-emerald-600 border border-emerald-100'
};

function toList(response) {
  const list = Array.isArray(response) ? response : response?.data ?? response?.content ?? [];
  return list.map((item) => ({
    id: item.id,
    leadId: item.leadId,
    leadName: item.leadName,
    followUpDate: item.followUpDate || item.date,
    followUpTime: item.followUpTime || '',
    mode: item.mode || 'Other',
    priority: item.priority || 'Medium',
    assignedUser: item.assignedUser || '',
    remarks: item.remarks || '',
    status: item.status || 'Pending',
    createdBy: item.createdBy || '',
    createdAt: item.createdAt
  }));
}

export default function FollowUps({ leadId, leadName, defaultOwner, assignedUsers = [], signal = 0 }) {
  const toast = useToast();
  const { data, loading, error, isFallback, refresh } = useAsyncData(
    () => leadService.getLeadFollowUps(leadId),
    { deps: [leadId] }
  );

  const prevSignal = useRef(signal);
  useEffect(() => {
    if (signal > 0 && signal !== prevSignal.current) {
      refresh();
    }
    prevSignal.current = signal;
  }, [signal, refresh]);

  const items = useMemo(
    () =>
      toList(data).sort((a, b) => {
        const da = new Date(a.followUpDate || 0);
        const db = new Date(b.followUpDate || 0);
        return da.getTime() - db.getTime();
      }),
    [data]
  );

  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const openSchedule = () => setModal({});
  const openEdit = (followUp) => setModal({ followUp });
  const closeModal = () => setModal(null);

  const handleRefresh = () => {
    refresh();
  };

  const runAction = async (followUp, action, successMessage) => {
    setBusyId(followUp.id);
    try {
      if (action === 'complete') {
        await leadService.completeFollowUp(leadId, followUp.id);
      } else if (action === 'cancel') {
        await leadService.cancelFollowUp(leadId, followUp.id);
      } else if (action === 'delete') {
        await leadService.deleteFollowUp(leadId, followUp.id);
      }
      toast.success(successMessage);
      setConfirm(null);
      refresh();
    } catch (err) {
      toast.error(err?.message || 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={openSchedule}
          className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#0B4A3D] hover:bg-[#083D34] px-4 py-2 rounded-lg transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Schedule Follow-up
        </button>
      </div>

      <DetailSection
        loading={loading}
        error={error}
        isFallback={isFallback}
        onRetry={refresh}
        count={items.length}
        emptyMessage="No follow-ups scheduled for this lead."
      >
        <ul className="space-y-3">
          {items.map((item) => {
            const Icon = MODE_ICONS[item.mode] || MODE_ICONS.default;
            const color = MODE_COLORS[item.mode] || MODE_COLORS.default;
            const completed = item.status === 'Completed';
            const cancelled = item.status === 'Cancelled';
            return (
              <li
                key={item.id}
                className={`bg-slate-50 border border-slate-100 rounded-lg p-3 ${completed || cancelled ? 'opacity-70' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg shrink-0 ${color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">
                          {formatDate(item.followUpDate)}
                          {item.followUpTime ? ` · ${item.followUpTime}` : ''}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_CHIPS[item.status] || STATUS_CHIPS.Pending}`}>
                          {item.status}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${PRIORITY_CHIPS[item.priority] || PRIORITY_CHIPS.Medium}`}>
                          {item.priority}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500">{item.mode}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!completed && !cancelled && (
                          <button
                            onClick={() => runAction(item, 'complete', 'Follow-up marked completed')}
                            disabled={busyId === item.id}
                            title="Complete"
                            className="p-1.5 text-[#0B4A3D] hover:text-[#059669] hover:bg-[#EDF7F4] rounded-md transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {busyId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        {!completed && !cancelled && (
                          <button
                            onClick={() => runAction(item, 'cancel', 'Follow-up cancelled')}
                            disabled={busyId === item.id}
                            title="Cancel"
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(item)}
                          title="Edit / Reschedule"
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirm(item)}
                          title="Delete"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {item.remarks && <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{item.remarks}</p>}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-[10px] text-slate-400 font-medium">
                      {item.assignedUser && <span>Assigned to <span className="text-slate-500 font-bold">{item.assignedUser}</span></span>}
                      {item.createdBy && <span>Scheduled by <span className="text-slate-500 font-bold">{item.createdBy}</span></span>}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </DetailSection>

      <ScheduleFollowUpModal
        key={modal ? `followup-${modal.followUp?.id || 'new'}` : 'followup-closed'}
        open={modal !== null}
        leadId={leadId}
        leadName={leadName}
        defaultOwner={defaultOwner}
        assignedUsers={assignedUsers}
        followUp={modal?.followUp || null}
        onClose={closeModal}
        onSaved={handleRefresh}
      />

      {confirm && (
        <ConfirmDialog
          open={confirm !== null}
          title="Delete Follow-up"
          message={`Delete the follow-up scheduled for ${formatDate(confirm.followUpDate)}${confirm.followUpTime ? ` at ${confirm.followUpTime}` : ''}? This action cannot be undone.`}
          confirmLabel="Delete"
          variant="danger"
          icon={Trash2}
          loading={busyId === confirm.id}
          onConfirm={() => runAction(confirm, 'delete', 'Follow-up deleted')}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
