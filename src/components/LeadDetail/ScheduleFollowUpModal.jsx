import { useState } from 'react';
import { CalendarClock, Loader2 } from 'lucide-react';
import { Modal, useToast } from '../Common';
import { FormField, TextInput, SelectInput, TextArea, SearchableSelect } from '../Common';
import leadService from '../../services/leadService';
import userService from '../../services/userService';

const MODES = ['Call', 'Meeting', 'Email', 'WhatsApp', 'Visit', 'Other'];
const PRIORITIES = ['High', 'Medium', 'Low'];
const STATUSES = ['Pending', 'Completed', 'Cancelled'];

function buildInitial(followUp, defaultOwner) {
  return {
    followUpDate: followUp?.followUpDate || '',
    followUpTime: followUp?.followUpTime || '10:00',
    mode: followUp?.mode || 'Call',
    priority: followUp?.priority || 'Medium',
    assignedUser: followUp?.assignedUser || defaultOwner || '',
    remarks: followUp?.remarks || '',
    status: followUp?.status || 'Pending'
  };
}

export default function ScheduleFollowUpModal({ open, leadId, leadName, defaultOwner, assignedUsers = [], followUp, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = Boolean(followUp);

  const [form, setForm] = useState(() => buildInitial(followUp, defaultOwner));
  const [ownerOptions, setOwnerOptions] = useState(() => [...assignedUsers]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    const next = { ...errors };
    if (!form.followUpDate) {
      next.followUpDate = 'Follow-up date is required';
    } else {
      delete next.followUpDate;
    }
    setErrors(next);
    if (next.followUpDate) return;
    if (saving) return;

    setSaving(true);
    try {
      const payload = {
        followUpDate: form.followUpDate,
        followUpTime: form.followUpTime || null,
        mode: form.mode,
        priority: form.priority,
        assignedUser: form.assignedUser || null,
        remarks: form.remarks || null,
        status: form.status
      };
      if (isEdit) {
        await leadService.updateFollowUp(leadId, followUp.id, payload);
        toast.success('Follow-up updated');
      } else {
        await leadService.addFollowUp(leadId, payload);
        toast.success('Follow-up scheduled');
      }
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Failed to save follow-up');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Follow-up' : 'Schedule Follow-up'}
      maxWidth="max-w-lg"
      footer={
        <>
          <button
            onClick={onClose}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#0B4A3D] hover:bg-[#083D34] px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarClock className="w-3.5 h-3.5" />}
            {isEdit ? 'Save Changes' : 'Schedule'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {leadName && (
          <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Lead</span>
            <p className="text-xs font-bold text-slate-800 truncate">{leadName}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Follow-up Date" required error={errors.followUpDate}>
            <TextInput
              type="date"
              value={form.followUpDate}
              onChange={(e) => update('followUpDate', e.target.value)}
            />
          </FormField>
          <FormField label="Follow-up Time">
            <TextInput
              type="time"
              value={form.followUpTime}
              onChange={(e) => update('followUpTime', e.target.value)}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Mode">
            <SelectInput value={form.mode} onChange={(e) => update('mode', e.target.value)}>
              {MODES.map((mode) => (
                <option key={mode} value={mode}>{mode}</option>
              ))}
            </SelectInput>
          </FormField>
          <FormField label="Priority">
            <SelectInput value={form.priority} onChange={(e) => update('priority', e.target.value)}>
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>{priority}</option>
              ))}
            </SelectInput>
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Assigned User">
            <SearchableSelect
              value={form.assignedUser}
              onChange={(value) => update('assignedUser', value)}
              creatable
              onCreate={async (name) => {
                try {
                  const created = await userService.createOwner(name);
                  const ownerName = created?.name || name;
                  setOwnerOptions((prev) => (prev.includes(ownerName) ? prev : [...prev, ownerName]));
                  update('assignedUser', ownerName);
                } catch (err) {
                  toast.error(err?.message || 'Failed to create owner');
                }
              }}
              options={ownerOptions.map((user) => ({ value: user, label: user }))}
              placeholder="Search and select an assignee"
            />
          </FormField>
          <FormField label="Status">
            <SelectInput value={form.status} onChange={(e) => update('status', e.target.value)}>
              {STATUSES.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </SelectInput>
          </FormField>
        </div>

        <FormField label="Remarks">
          <TextArea
            rows={3}
            value={form.remarks}
            onChange={(e) => update('remarks', e.target.value)}
            placeholder="Add any remarks or context for this follow-up..."
          />
        </FormField>
      </div>
    </Modal>
  );
}
