"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ChevronDown } from "lucide-react";

type LocationSelectorProps = {
  campusList: string[];
  value: string | null;
  onChange: (value: string | null) => void;
};

export function LocationSelector({ campusList, value, onChange }: LocationSelectorProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="px-4 pb-2">
      <p className="text-sm font-medium text-muted-foreground mb-1.5">Lokasi</p>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between text-sm font-normal"
          >
            {value
              ? campusList.find((c) => c === value) ?? value
              : "Pilih gedung kampus..."}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput placeholder="Cari kampus..." className="h-9" />
            <CommandList>
              <CommandEmpty>Gagal memuat data kampus. Coba refresh halaman.</CommandEmpty>
              <CommandGroup>
                {campusList.map((campus) => (
                  <CommandItem
                    key={campus}
                    value={campus}
                    onSelect={(currentValue) => {
                      onChange(currentValue === value ? null : currentValue);
                      setOpen(false);
                    }}
                    data-selected={value === campus}
                  >
                    {campus}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
