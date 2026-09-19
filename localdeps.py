"""Enable the project-local dependency bundle without a virtual environment."""
from pathlib import Path
import sys


def ensure_local_dependencies() -> None:
    deps = Path(__file__).resolve().parent / ".deps"
    if deps.is_dir() and str(deps) not in sys.path:
        sys.path.insert(0, str(deps))
