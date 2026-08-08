import {
  CalendarClock, PhoneCall, Mail, User, Building2, Briefcase, MapPin, Factory,
  IndianRupee, Paperclip, PencilLine, MessageCircle, ClipboardList, Target, Flag,
  Bell, CalendarDays
} from 'lucide-react';
import { Modal } from '../Common';
import { FOLLOWUP_STATUS_BADGES, FOLLOWUP_PRIORITY_BADGES, FOLLOWUP_MODE_ICONS, FOLLOWUP_MODE_COLORS } from '../../utils/followUpConstants';
import { formatDate, formatDateTime, formatINR, formatBytes, attachmentType, getInitials, avatarColor } from '../../utils/followUpHelpers';

const MODE_ICON_MAP = { PhoneCall, Mail, User, MessageCircle, MapPin, ClipboardList, CalendarClock };

function Field({ icon: Icon, label, value, secondary }) {
  if (!value && !secondary) return null;
  return (
    <div className="flex items-start gap-2.5">
      <div className="p-1.5 rounded-md bg-slate-100 text-slate-400 shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
        <div className="text-xs font-semibold text-slate-700 break-words">{value || '—'}</div>
        {secondary && <div className="text-[11px] font-medium text-slate-400">{secondary}</div>}
      </div>
    </div>
  );
}

export default function FollowUpDetailsModal({ open, followUp, onClose, onEdit }) {
  if (!followUp) return null;
  const ModeIcon = MODE_ICON_MAP[FOLLOWUP_MODE_ICONS[followUp.mode] || FOLLOWUP_MODE_ICONS.default] || CalendarClock;
  const modeColor = FOLLOWUP_MODE_COLORS[followUp.mode] || FOLLOWUP_MODE_COLORS.default;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Follow-up Details"
      maxWidth="max-w-2xl"
      footer={
        <>
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg transition-colors cursor-pointer"
            >
              <PencilLine className="w-3.5 h-3.5" /> Edit Follow-up
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs font-bold text-white bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] hover:from-[#1d4ed8] hover:to-[#1e40af] px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-bold text-slate-500">{followUp.followUpNo || '—'}</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${FOLLOWUP_STATUS_BADGES[followUp.status] || FOLLOWUP_STATUS_BADGES.Pending}`}>
            {followUp.status}
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${FOLLOWUP_PRIORITY_BADGES[followUp.priority] || FOLLOWUP_PRIORITY_BADGES.Medium}`}>
            {followUp.priority}
          </span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${modeColor}`}>
            <ModeIcon className="w-3 h-3" /> {followUp.mode}
          </span>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-[11px] ${avatarColor(followUp.leadName)} border border-black/5 shrink-0`}>
            {getInitials(followUp.leadName)}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-900 truncate">{followUp.leadName || '—'}</div>
            <div className="text-[11px] font-medium text-slate-400 truncate">
              {[followUp.leadCompany, followUp.leadDesignation].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
        </div>

        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Lead</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field icon={PhoneCall} label="Phone" value={followUp.leadPhone} />
            <Field icon={Mail} label="Email" value={followUp.leadEmail} />
            <Field icon={Building2} label="Company" value={followUp.leadCompany} />
            <Field icon={Briefcase} label="Designation" value={followUp.leadDesignation} />
            <Field icon={Factory} label="Industry" value={followUp.leadIndustry} />
            <Field icon={MapPin} label="Location" value={followUp.leadAddress} secondary={followUp.leadCity} />
            <Field icon={Flag} label="Stage" value={followUp.leadStage} />
            <Field icon={User} label="Lead Owner" value={followUp.leadOwner} />
            <Field icon={IndianRupee} label="Value" value={formatINR(followUp.leadValue)} />
          </div>
        </div>

        <div className="border-t border-slate-100" />

        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Follow-up</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field icon={CalendarClock} label="Date" value={formatDate(followUp.followUpDate)} secondary={followUp.followUpTime} />
            <Field icon={User} label="Assigned To" value={followUp.assignedUser} />
            <Field icon={CalendarDays} label="Next Follow-up" value={formatDate(followUp.nextFollowUpDate)} />
            <Field icon={Bell} label="Reminder" value={followUp.reminderType ? `${followUp.reminder} (${followUp.reminderType})` : followUp.reminder} />
            <Field icon={User} label="Created By" value={followUp.createdBy} secondary={formatDateTime(followUp.createdAt)} />
          </div>
        </div>

        <div className="border-t border-slate-100" />

        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Engagement</div>
          <div className="grid grid-cols-1 gap-3">
            {followUp.remarks && <Field icon={ClipboardList} label="Remarks" value={followUp.remarks} />}
            {followUp.outcome && <Field icon={Target} label="Outcome" value={followUp.outcome} />}
            {followUp.discussion && <Field icon={MessageCircle} label="Discussion" value={followUp.discussion} />}
            {followUp.feedback && <Field icon={MessageCircle} label="Feedback" value={followUp.feedback} />}
            {followUp.requirement && <Field icon={ClipboardList} label="Requirement" value={followUp.requirement} />}
            {!followUp.remarks && !followUp.outcome && !followUp.discussion && !followUp.feedback && !followUp.requirement && (
              <div className="text-xs font-medium text-slate-400">No engagement notes recorded.</div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100" />

        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Attachments</div>
          {followUp.attachments && followUp.attachments.length > 0 ? (
            <div className="space-y-2">
              {followUp.attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 hover:border-blue-400/60 hover:bg-slate-50 transition-colors group"
                >
                  <span className={`p-1.5 rounded-md shrink-0 ${attachmentType(attachment.name) === 'image' ? 'bg-emerald-50 text-emerald-600' : attachmentType(attachment.name) === 'pdf' ? 'bg-rose-50 text-rose-600' : attachmentType(attachment.name) === 'word' ? 'bg-sky-50 text-sky-600' : attachmentType(attachment.name) === 'sheet' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                    <Paperclip className="w-3.5 h-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-700 group-hover:text-blue-600 transition-colors truncate">{attachment.name}</div>
                    <div className="text-[10px] font-medium text-slate-400">{formatBytes(attachment.size)}</div>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="text-xs font-medium text-slate-400">No attachments.</div>
          )}
        </div>
      </div>
    </Modal>
  );
}
