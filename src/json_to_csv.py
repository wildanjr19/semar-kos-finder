"""
Convert a JSON file into CSV format.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path


INPUT_JSON = Path("../frontend/public/data/data_kost_geo.json")
OUTPUT_CSV = Path("../data/final/data_kos_geo_full.csv")


def json_to_csv(input_json: Path, output_csv: Path) -> int:
	"""Read JSON array and write rows to CSV."""
	with input_json.open("r", encoding="utf-8") as json_file:
		rows = json.load(json_file)

	if not rows:
		return 0

	fieldnames = list(rows[0].keys())

	with output_csv.open("w", encoding="utf-8-sig", newline="") as csv_file:
		writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
		writer.writeheader()
		writer.writerows(rows)

	return len(rows)


def main() -> None:
	if not INPUT_JSON.exists():
		raise FileNotFoundError(f"Input JSON not found: {INPUT_JSON}")

	OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)

	row_count = json_to_csv(input_json=INPUT_JSON, output_csv=OUTPUT_CSV)
	print(f"Converted {row_count} rows")
	print(f"CSV saved to: {OUTPUT_CSV}")


if __name__ == "__main__":
	main()
