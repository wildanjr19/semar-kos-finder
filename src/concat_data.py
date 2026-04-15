import pandas as pd

# Input file paths
INPUT_CSV_1 = "data/final/data_kost_v1_geo.csv"
INPUT_CSV_2 = "data/final/data_kost_2023_geo.csv"

# Read CSV files
df1 = pd.read_csv(INPUT_CSV_1)
df2 = pd.read_csv(INPUT_CSV_2)

# Concatenate by row (vertically)
df_concat = pd.concat([df1, df2], ignore_index=True)

# Renumber the "No" column from 1 to end
df_concat["No"] = range(1, len(df_concat) + 1)

# Save result
OUTPUT_CSV = "data/final/data_kost_geo_v2.csv"
df_concat.to_csv(OUTPUT_CSV, index=False)

print(f"Concatenation complete. Result saved to: {OUTPUT_CSV}")
print(f"Total rows: {len(df_concat)}")
