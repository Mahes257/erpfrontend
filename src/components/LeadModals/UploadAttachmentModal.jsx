import { useRef, useState } from 'react';
import { Paperclip, Loader2 } from 'lucide-react';
import { Modal, FormField } from '../Common';

export default function UploadAttachmentModal({ open, lead, onClose, onSubmit }) {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSelect = (event) => {
    const selected = event.target.files?.[0] || null;
    setFile(selected);
    setError('');
  };

  const handleSave = async () => {
    if (!file || submitting) return;
    setSubmitting(true);
    setError('');
    const ok = await onSubmit?.(file);
    if (!ok) setSubmitting(false);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Upload Attachment"
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
            disabled={!file || submitting}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] hover:from-[#1d4ed8] hover:to-[#1e40af] disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
            Upload
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 font-bold text-sm">
            {lead?.name?.slice(0, 1).toUpperCase() || '?'}
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">{lead?.name || 'Lead'}</div>
            <div className="text-[11px] text-slate-400 font-medium">{lead?.company || ''}</div>
          </div>
        </div>

        <FormField label="File" required error={error}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/50 rounded-lg px-4 py-6 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
          >
            <Paperclip className="w-4 h-4" />
            {file ? file.name : 'Click to choose a file'}
          </button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleSelect} />
        </FormField>
      </div>
    </Modal>
  );
}
