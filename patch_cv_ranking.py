#!/usr/bin/env python3
"""Apply the CV-ranking route completion patch to a local cv-ranker clone."""

from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit("Usage: python3 patch_cv_ranking.py /path/to/cv-ranker")

repo = Path(sys.argv[1]).expanduser().resolve()
route_path = repo / "artifacts/api-server/src/routes/cv-ranking.ts"

if not route_path.is_file():
    raise SystemExit(f"Target route not found: {route_path}")

source = route_path.read_text(encoding="utf-8")
expected_tail = "    const parsedData = JSON.parse(responseText);\n    return res.status(200).json(parsedData);\n"

if "export default router" in source:
    raise SystemExit("Route already contains an export; refusing to apply the patch twice.")
if not source.endswith(expected_tail):
    raise SystemExit("The route does not match the expected incomplete source tail; refusing to modify it.")

replacement_tail = '''    let parsedData: unknown;
    try {
      parsedData = JSON.parse(responseText);
    } catch (error) {
      console.error("Gemini returned malformed JSON", error);
      return res
        .status(502)
        .json({ error: "Gemini returned an invalid analysis response" });
    }

    return res.status(200).json(parsedData);
  } catch (error) {
    console.error("CV ranking request failed", error);
    return res.status(500).json({ error: "Failed to analyze CV" });
  }
});

export default router;
'''

route_path.write_text(source[: -len(expected_tail)] + replacement_tail, encoding="utf-8")
print(f"Patched {route_path}")
