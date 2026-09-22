"""Print schema and row count without displaying source rows."""
from pathlib import Path
import subprocess
root = Path('.')
python = next((root / '.ingestron/runtimes').glob('*/bin/python'), None)
files = list((root / 'build/generated/data/issues_local').glob('*/issues-001/issues.parquet'))
if python is None or len(files) != 1:
    raise SystemExit('Run the issues-001 example successfully before inspecting output.')
subprocess.run([str(python), '-c', 'import sys,pyarrow.parquet as p;t=p.read_table(sys.argv[1]);print(t.schema);print("Rows:",t.num_rows)', str(files[0])], check=True)
