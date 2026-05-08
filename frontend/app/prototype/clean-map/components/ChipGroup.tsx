"use client";

import type { ReactNode } from "react";

type ChipOption = {
  value: string;
  label: string;
};

type ChipGroupProps = {
  options: ChipOption[];
  value: string | string[] | null;
  onChange: (value: string | string[] | null) => void;
  mode: "radio" | "multi";
  label?: string;
};

export function ChipGroup({ options, value, onChange, mode, label }: ChipGroupProps) {
  const isSelected = (optValue: string) => {
    if (mode === "radio") return value === optValue;
    return Array.isArray(value) && value.includes(optValue);
  };

  const handleClick = (optValue: string) => {
    if (mode === "radio") {
      onChange(value === optValue ? null : optValue);
    } else {
      const current = Array.isArray(value) ? value : [];
      onChange(
        current.includes(optValue)
          ? current.filter((v) => v !== optValue)
          : [...current, optValue]
      );
    }
  };

  return (
    <div>
      {label && <p className="text-sm font-medium text-muted-foreground mb-2">{label}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleClick(opt.value)}
            className={`
              inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium
              transition-colors duration-150 cursor-pointer
              ${
                isSelected(opt.value)
                  ? "bg-[#0f766e] text-white shadow-sm"
                  : "bg-slate-200 text-slate-700 hover:bg-slate-300"
              }
            `}
            aria-pressed={isSelected(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
