"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type FacilitiesSectionProps = {
  selectedFacilities: string[];
  onChange: (value: string[]) => void;
};

const FACILITY_CATEGORIES = [
  {
    label: "Dalam Kamar",
    items: [
      "Kasur",
      "Lemari",
      "Meja Belajar",
      "Kursi",
      "AC",
      "Kipas Angin",
      "TV",
      "Kamar Mandi Dalam",
      "Water Heater",
      "Spring Bed",
    ],
  },
  {
    label: "Bersama",
    items: [
      "Dapur",
      "Ruang Tamu",
      "Ruang Makan",
      "Parkir Motor",
      "Parkir Mobil",
      "Laundry",
      "Koperasi",
      "Kantin",
      "Mushola",
      "Wifi",
      "Tempat Jemuran",
      "CCTV",
      "Lemari Es",
      "Air Minum",
    ],
  },
  {
    label: "Utilitas",
    items: [
      "Listrik",
      "Air",
      "Internet",
      "Listrik + Air",
      "Listrik + Air + Internet",
      "Listrik + Internet",
      "Free Wifi",
    ],
  },
];

export function FacilitiesSection({ selectedFacilities, onChange }: FacilitiesSectionProps) {
  const isChecked = (item: string) => selectedFacilities.includes(item);

  const handleToggle = (item: string) => {
    onChange(
      isChecked(item)
        ? selectedFacilities.filter((f) => f !== item)
        : [...selectedFacilities, item]
    );
  };

  return (
    <div className="space-y-5 px-2 py-2">
      {FACILITY_CATEGORIES.map((category) => (
        <div key={category.label}>
          <p className="text-sm text-muted-foreground mb-2 font-medium">{category.label}</p>
          <div className="space-y-2.5">
            {category.items.map((item) => (
              <div key={item} className="flex items-center gap-2">
                <Checkbox
                  id={`facility-${item}`}
                  checked={isChecked(item)}
                  onCheckedChange={() => handleToggle(item)}
                  className="data-[state=checked]:bg-[#0f766e] data-[state=checked]:border-[#0f766e]"
                />
                <Label
                  htmlFor={`facility-${item}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {item}
                </Label>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
