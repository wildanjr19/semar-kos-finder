# Project Structure

```text
UNSKosFinder/
|-- PROJECT_BRIEF.md
|-- PROJECT_STRUCTURE.MD
|-- README.md
|-- TODO.md
|-- data/
|   |-- final/
|   |   `-- data_kos_geo.csv
|   |-- preprocessed/
|   |   |-- data_kos_cleaned_capitalized.csv
|   |   |-- data_kos_cleaned_fixed.csv
|   |   |-- data_kos_cleaned_uncapitalized.csv
|   |   `-- data_kos_cleaned_with_address.csv
|   `-- raw/
|       |-- data_kos_concat.csv
|       |-- data_kost_2025.csv
|       `-- data_kost_extracted.csv
|-- dump/
|   |-- data_kos_cleaned.csv
|   `-- data_kos_geo.csv
|-- frontend/
|   |-- next-env.d.ts
|   |-- package.json
|   |-- tsconfig.json
|   |-- app/
|   |   |-- layout.tsx
|   |   `-- page.tsx
|   |-- components/
|   |   `-- Map.tsx
|   `-- public/
|       `-- data/
|           |-- data_kost_geo.json
|           `-- master_uns.json
|-- log/
|-- notebooks/
|   |-- check_duplicate.ipynb
|   |-- cleaning.ipynb
|   `-- concat.ipynb
|-- notes/
|   |-- FLAGGED.md
|   `-- NOTES.md
`-- src/
	|-- check_duplicate.py
	|-- csv_to_json.py
	|-- extract_pdf.py
	|-- geocoding_location.py
	`-- get_addres_plus_code.py
```
