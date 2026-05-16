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
import { FacilitiesSection } from "./FacilitiesSection";
import { RulesSection } from "./RulesSection";

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
      <div className="px-4 pb-2">
        <label htmlFor="distance-max-km" className="text-sm font-medium text-muted-foreground mb-1.5 block">
          Jarak Maksimum (km)
        </label>
        <select
          id="distance-max-km"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={filterState.distanceMaxKm}
          onChange={(e) => updater("distanceMaxKm")(e.target.value)}
        >
          <option value="0.5">0.5</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="5">5</option>
          <option value="Semua">Semua</option>
        </select>
      </div>

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

        {/* Fasilitas */}
        <AccordionItem value="fasilitas">
          <AccordionTrigger className="text-base font-semibold px-2">
            Fasilitas
          </AccordionTrigger>
          <AccordionContent>
            <FacilitiesSection
              selectedFacilities={filterState.selectedFacilities}
              onChange={updater("selectedFacilities")}
            />
          </AccordionContent>
        </AccordionItem>

        {/* Peraturan */}
        <AccordionItem value="peraturan">
          <AccordionTrigger className="text-base font-semibold px-2">
            Peraturan
          </AccordionTrigger>
          <AccordionContent>
            <RulesSection
              selectedJamMalam={filterState.selectedJamMalam}
              selectedTamuLawanJenis={filterState.selectedTamuLawanJenis}
              selectedTamuMenginap={filterState.selectedTamuMenginap}
              selectedBolehHewan={filterState.selectedBolehHewan}
              onJamMalamChange={updater("selectedJamMalam")}
              onTamuLawanJenisChange={updater("selectedTamuLawanJenis")}
              onTamuMenginapChange={updater("selectedTamuMenginap")}
              onBolehHewanChange={updater("selectedBolehHewan")}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
