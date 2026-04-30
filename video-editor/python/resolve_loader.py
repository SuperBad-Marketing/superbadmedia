"""
Patched DaVinci Resolve script loader.
Replaces the stock DaVinciResolveScript.py which uses `imp` (removed in Python 3.12+).
"""

import sys
import os
import importlib.util


def _find_fusionscript():
    """Locate fusionscript.so on this system."""
    # Check env var first
    lib_path = os.getenv("RESOLVE_SCRIPT_LIB")
    if lib_path and os.path.isfile(lib_path):
        return lib_path

    # macOS search paths — check all mounted volumes + default location
    candidates = [
        "/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/fusionscript.so",
    ]

    # Search mounted volumes
    if os.path.isdir("/Volumes"):
        for vol in os.listdir("/Volumes"):
            candidates.append(
                f"/Volumes/{vol}/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/fusionscript.so"
            )

    for path in candidates:
        if os.path.isfile(path):
            return path

    return None


def load():
    """Load and return the fusionscript module, or None."""
    # Try direct import first (works if Resolve added itself to PATH)
    try:
        import fusionscript
        return fusionscript
    except ImportError:
        pass

    lib_path = _find_fusionscript()
    if not lib_path:
        return None

    spec = importlib.util.spec_from_file_location("fusionscript", lib_path)
    if spec is None or spec.loader is None:
        return None

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    sys.modules["fusionscript"] = module
    return module
