"use client";

import { Input } from "@/components/ui/input";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
};

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="px-4 pt-3 pb-2">
      <Input
        type="text"
        placeholder="Cari nama atau alamat kos..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full focus-visible:ring-2 focus-visible:ring-[#0f766e]"
      />
    </div>
  );
}
