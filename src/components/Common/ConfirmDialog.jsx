import { Loader2 } from 'lucide-react';
import Modal from './Modal';

const ICON_VARIANTS = {
  danger: 'bg-rose-50 text-rose-500',
  warning: 'bg-amber-50 text-amber-500',
  default: 'bg-slate-100 text-slate-500'
};

const BUTTON_VARIANTS = {
  danger: 'bg-rose-600 hover:bg-rose-700 text-white border border-rose-600',
  warning: 'bg-amber-600 hover:bg-amber-700 text-white border border-amber-600',
  default: 'bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] hover:from-[#1d4ed8] hover:to-[#1e40af] text-white border border-[#2563eb]'
};

export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  variant = 'danger',
  icon: Icon,
  loading = false,
  onConfirm,
  onCancel
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-surface border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${BUTTON_VARIANTS[variant]}`}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        {Icon && (
          <div className={`p-2 rounded-lg shrink-0 ${ICON_VARIANTS[variant]}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
        <p className="text-xs text-slate-600 leading-relaxed">{message}</p>
      </div>
    </Modal>
  );
}
