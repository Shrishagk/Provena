"""Make the project-local dependency bundle available when run from this repo."""
from pathlib import Path
import sys

_deps = Path(__file__).resolve().parent / ".deps"
if _deps.is_dir():
    sys.path.insert(0, str(_deps))
