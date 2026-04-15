"""
Convert a CSV file into JSON for frontend consumption.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path


INPUT_CSV = Path("data/final/data_kost_geo_v2.csv")
OUTPUT_JSON = Path("frontend/public/data/data_kost_geo.json")


def csv_to_json(input_csv: Path, output_json: Path) -> int:
	"""Read CSV rows and write them as a JSON array."""
	with input_csv.open("r", encoding="utf-8-sig", newline="") as csv_file:
		reader = csv.DictReader(csv_file)
		rows = list(reader)

	# keep unicode characters readable and provide stable pretty output
	with output_json.open("w", encoding="utf-8") as json_file:
		json.dump(rows, json_file, ensure_ascii=False, indent=2)

	return len(rows)


def main() -> None:
	if not INPUT_CSV.exists():
		raise FileNotFoundError(f"Input CSV not found: {INPUT_CSV}")

	OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)

	row_count = csv_to_json(input_csv=INPUT_CSV, output_json=OUTPUT_JSON)
	print(f"Converted {row_count} rows")
	print(f"JSON saved to: {OUTPUT_JSON}")


if __name__ == "__main__":
	main()
