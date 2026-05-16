export type FilterState = {
  searchText: string;
  selectedCampus: string | null;
  selectedGender: string | null;
  selectedAc: string | null;
  priceMin: string;
  priceMax: string;
  pricePeriod: string;
  selectedPaymentTypes: string[];
  selectedFacilities: string[];
  selectedJamMalam: string | null;
  selectedTamuLawanJenis: string | null;
  selectedTamuMenginap: string | null;
  selectedBolehHewan: string | null;
  distanceMaxKm: string;
};

export const DEFAULT_FILTER_STATE: FilterState = {
  searchText: "",
  selectedCampus: null,
  selectedGender: null,
  selectedAc: null,
  priceMin: "",
  priceMax: "",
  pricePeriod: "bulanan",
  selectedPaymentTypes: [],
  selectedFacilities: [],
  selectedJamMalam: null,
  selectedTamuLawanJenis: null,
  selectedTamuMenginap: "Semua",
  selectedBolehHewan: "Semua",
  distanceMaxKm: "Semua",
};
