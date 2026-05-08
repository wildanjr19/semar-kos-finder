"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ChipGroup } from "./ChipGroup";

type BillingSectionProps = {
  priceMin: string;
  priceMax: string;
  pricePeriod: string;
  selectedPaymentTypes: string[];
  onPriceMinChange: (value: string) => void;
  onPriceMaxChange: (value: string) => void;
  onPricePeriodChange: (value: string) => void;
  onPaymentTypesChange: (value: string | string[] | null) => void;
};

const PERIOD_OPTIONS = [
  { value: "mingguan", label: "Mingguan" },
  { value: "bulanan", label: "Bulanan" },
  { value: "per 3 bulan", label: "Per 3 Bulan" },
  { value: "semesteran", label: "Semesteran" },
  { value: "tahunan", label: "Tahunan" },
];

// Payment types — extracted from existing KosClean data patterns
const PAYMENT_OPTIONS = [
  { value: "bulanan", label: "Bulanan" },
  { value: "semesteran", label: "Semesteran" },
  { value: "tahunan", label: "Tahunan" },
  { value: "per 3 bulan", label: "Per 3 Bulan" },
  { value: "mingguan", label: "Mingguan" },
];

export function BillingSection({
  priceMin,
  priceMax,
  pricePeriod,
  selectedPaymentTypes,
  onPriceMinChange,
  onPriceMaxChange,
  onPricePeriodChange,
  onPaymentTypesChange,
}: BillingSectionProps) {
  return (
    <div className="space-y-5 px-2 py-2">
      {/* ── Rentang Harga ── */}
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-2">Rentang Harga</p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="Min"
            value={priceMin}
            onChange={(e) => onPriceMinChange(e.target.value)}
            className="flex-1"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="number"
            placeholder="Maks"
            value={priceMax}
            onChange={(e) => onPriceMaxChange(e.target.value)}
            className="flex-1"
          />
        </div>
      </div>

      {/* ── Periode ── */}
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-2">Periode</p>
        <Select value={pricePeriod} onValueChange={onPricePeriodChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Pilih periode" />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Tipe Pembayaran ── */}
      <ChipGroup
        label="Tipe Pembayaran"
        options={PAYMENT_OPTIONS}
        value={selectedPaymentTypes}
        onChange={onPaymentTypesChange}
        mode="multi"
      />
    </div>
  );
}
