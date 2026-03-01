"use client";

import { useState } from "react";

interface TransactionPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  details: {
    label: string;
    value: string;
    highlight?: boolean;
  }[];
  confirmText?: string;
  isLoading?: boolean;
}

export function TransactionPreviewModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  details,
  confirmText = "Confirm",
  isLoading = false,
}: TransactionPreviewModalProps) {
  const [understood, setUnderstood] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-[#154A99] bg-[#07203F] p-6 shadow-xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="text-[#A68A7A] hover:text-white transition"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Description */}
        {description && (
          <p className="mb-4 text-sm text-[#A68A7A]">{description}</p>
        )}

        {/* Details */}
        <div className="mb-6 space-y-3 rounded-lg bg-[#0A2A52] p-4">
          {details.map((detail, index) => (
            <div key={index} className="flex items-center justify-between">
              <span className="text-sm text-[#A68A7A]">{detail.label}</span>
              <span className={`font-mono text-sm ${detail.highlight ? "text-[#D9AA90]" : "text-white"}`}>
                {detail.value}
              </span>
            </div>
          ))}
        </div>

        {/* Gas Warning */}
        <div className="mb-4 rounded-lg border border-yellow-600/30 bg-yellow-600/10 p-3">
          <p className="text-xs text-yellow-500">
            ⚠️ Gas fees are estimates and may vary. Network congestion can affect final costs.
          </p>
        </div>

        {/* Checkbox for important transactions */}
        <label className="mb-4 flex cursor-pointer items-start gap-2 text-sm text-[#A68A7A]">
          <input
            type="checkbox"
            checked={understood}
            onChange={(e) => setUnderstood(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-[#154A99] bg-[#0A2A52] text-[#A65E46] focus:ring-[#A65E46]"
          />
          <span>I understand this is an on-chain transaction that cannot be easily reversed.</span>
        </label>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-[#154A99] px-4 py-2 text-[#D9AA90] transition hover:bg-[#154A99]/20"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!understood || isLoading}
            className="flex-1 rounded-lg bg-[#A65E46] px-4 py-2 text-white transition hover:bg-[#C47154] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Processing..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
