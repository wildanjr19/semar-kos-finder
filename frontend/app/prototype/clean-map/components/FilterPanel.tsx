"use client";

import type { Dispatch, SetStateAction } from "react";
import type { FilterState } from "./filter-types";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { SearchBar } from "./SearchBar";
import { LocationSelector } from "./LocationSelector";
import { RoomSection } from "./RoomSection";
import { BillingSection } from "./BillingSection";

// Plan 03 will import and wire FacilitiesSection and RulesSection here

type FilterPanelProps = {
  filterState: FilterState;
  setFilterState: Dispatch<SetStateAction<FilterState>>;
  campusList: string[];
};

export function FilterPanel({ filterState, setFilterState, campusList }: FilterPanelProps) {
  const updater = <K extends keyof FilterState>(key: K) => (value: FilterState[K]) => {
    setFilterState((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="flex flex-col">
      {/* ── Standalone Search + Location bar ── */}
      <SearchBar value={filterState.searchText} onChange={updater("searchText")} />
      <LocationSelector
        campusList={campusList}
        value={filterState.selectedCampus}
        onChange={updater("selectedCampus")}
      />

      {/* ── Accordion sections ── */}
      <Accordion type="multiple" className="w-full px-2">
        {/* Kamar */}
        <AccordionItem value="kamar">
          <AccordionTrigger className="text-base font-semibold px-2">
            Kamar
          </AccordionTrigger>
          <AccordionContent>
            <RoomSection
              selectedGender={filterState.selectedGender}
              selectedAc={filterState.selectedAc}
              onGenderChange={updater("selectedGender")}
              onAcChange={updater("selectedAc")}
            />
          </AccordionContent>
        </AccordionItem>

        {/* Pembayaran */}
        <AccordionItem value="pembayaran">
          <AccordionTrigger className="text-base font-semibold px-2">
            Pembayaran
          </AccordionTrigger>
          <AccordionContent>
            <BillingSection
              priceMin={filterState.priceMin}
              priceMax={filterState.priceMax}
              pricePeriod={filterState.pricePeriod}
              selectedPaymentTypes={filterState.selectedPaymentTypes}
              onPriceMinChange={updater("priceMin")}
              onPriceMaxChange={updater("priceMax")}
              onPricePeriodChange={updater("pricePeriod")}
              onPaymentTypesChange={updater("selectedPaymentTypes")}
            />
          </AccordionContent>
        </AccordionItem>

        {/* Fasilitas — TODO: Plan 03 */}
        <AccordionItem value="fasilitas">
          <AccordionTrigger className="text-base font-semibold px-2">
            Fasilitas
          </AccordionTrigger>
          <AccordionContent>
            {/* FacilitiesSection goes here in Plan 03 */}
            <p className="text-sm text-muted-foreground px-2 py-4">
              Fasilitas filter akan ditambahkan.
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* Peraturan — TODO: Plan 03 */}
        <AccordionItem value="peraturan">
          <AccordionTrigger className="text-base font-semibold px-2">
            Peraturan
          </AccordionTrigger>
          <AccordionContent>
            {/* RulesSection goes here in Plan 03 */}
            <p className="text-sm text-muted-foreground px-2 py-4">
              Peraturan filter akan ditambahkan.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
