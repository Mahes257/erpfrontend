import { useRef, useState } from 'react';
import { CloudUpload, FileText, X } from 'lucide-react';

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Create-mode attachments: lets the user stage files before the document exists.
 * Files are uploaded automatically after the document is created (see the parent
 * save flow), so no file is ever stored without a parent document.
 */
export default function PendingAttachments({ files = [], onChange }) {
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (fileList) => {
    const next = Array.from(fileList || []).filter(
      (file) => !files.some((f) => f.name === file.name && f.size === file.size)
    );
    if (next.length === 0) return;
    onChange([...files, ...next]);
  };

  const removeFile = (index) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer?.files);
        }}
        className={`border-2 border-dashed rounded-xl py-6 px-4 text-center cursor-pointer transition-all ${
          dragOver ? 'border-[#0B4A3D] bg-[#E8F0EE]/60' : 'border-slate-300 hover:border-[#0B4A3D] hover:bg-[#E8F0EE]/40'
        }`}
      >
        <CloudUpload className="w-6 h-6 text-[#0B4A3D] mx-auto mb-2" />
        <p className="text-xs font-semibold text-slate-700">
          Drag &amp; drop files here or <span className="text-[#0B4A3D] font-bold">browse</span>
        </p>
        <p className="text-[11px] text-slate-400 mt-1">Uploaded after this document is saved. PDF, DOCX, XLSX, PNG, JPG up to 10MB</p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((file, index) => (
            <div key={`${file.name}-${file.size}`} className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <FileText className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate">{file.name}</p>
                <p className="text-[10px] text-slate-400">{formatBytes(file.size)}</p>
              </div>
              <button
                type="button"
                title="Remove"
                onClick={() => removeFile(index)}
                className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
