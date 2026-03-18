#!/usr/bin/env python3

import json
import sys
from pathlib import Path

ALLOWED_BLOCKS = {
    "slideshow": {
        "required": {"type", "source", "variant"},
        "allowed": {"type", "source", "variant"},
    },
    "grid": {
        "required": {"type", "source", "variant"},
        "allowed": {"type", "source", "variant"},
    },
    "text": {
        "required": {"type", "source"},
        "allowed": {"type", "source"},
    },
    "video": {
        "required": {"type", "source"},
        "allowed": {"type", "source"},
    },
    "separator": {
        "required": {"type"},
        "allowed": {"type"},
    },
}

VALID_VARIANTS = {"single", "multi"}
VALID_VIDEO_HOSTS = {"YT", "Vimeo"}


def add_error(errors, project_id, block_index, message):
    errors.append(f"{project_id} | block {block_index}: {message}")


def validate_block(project, block, block_index, errors):
    project_id = project.get("id", "<missing-id>")
    block_type = block.get("type")
    content = project.get("content", {})

    if block_type not in ALLOWED_BLOCKS:
        add_error(errors, project_id, block_index, f"Unknown block type '{block_type}'")
        return

    rules = ALLOWED_BLOCKS[block_type]
    keys = set(block.keys())

    missing = sorted(rules["required"] - keys)
    extra = sorted(keys - rules["allowed"])

    if missing:
        add_error(errors, project_id, block_index, f"Missing keys: {', '.join(missing)}")

    if extra:
        add_error(errors, project_id, block_index, f"Extra keys not allowed: {', '.join(extra)}")

    if "source" in block:
        source = block["source"]
        if source not in content:
            add_error(errors, project_id, block_index, f"Source '{source}' not found in content")

    if block_type in {"slideshow", "grid"} and "variant" in block:
        if block["variant"] not in VALID_VARIANTS:
            add_error(
                errors,
                project_id,
                block_index,
                f"Invalid variant '{block['variant']}', expected one of: single, multi",
            )

    if block_type == "video" and "source" in block and block["source"] in content:
        video_obj = content[block["source"]]
        if not isinstance(video_obj, dict):
            add_error(errors, project_id, block_index, "Video source must be an object")
            return

        if "host" not in video_obj or "link" not in video_obj:
            add_error(errors, project_id, block_index, "Video object must contain 'host' and 'link'")
        else:
            if video_obj["host"] not in VALID_VIDEO_HOSTS:
                add_error(
                    errors,
                    project_id,
                    block_index,
                    f"Invalid video host '{video_obj['host']}', expected YT or Vimeo",
                )
            if not isinstance(video_obj["link"], str) or not video_obj["link"].strip():
                add_error(errors, project_id, block_index, "Video link must be a non-empty string")


def validate_project(project, errors):
    project_id = project.get("id", "<missing-id>")

    for field in ["id", "title", "date", "layout", "content"]:
        if field not in project:
            errors.append(f"{project_id}: Missing top-level field '{field}'")

    if "layout" in project and not isinstance(project["layout"], list):
        errors.append(f"{project_id}: 'layout' must be an array")
        return

    if "content" in project and not isinstance(project["content"], dict):
        errors.append(f"{project_id}: 'content' must be an object")
        return

    layout = project.get("layout", [])
    for i, block in enumerate(layout, start=1):
        if not isinstance(block, dict):
            add_error(errors, project_id, i, "Layout block must be an object")
            continue
        validate_block(project, block, i, errors)


def main():
    if len(sys.argv) < 2:
        print("Usage: python validate_projects.py path/to/projects.json")
        sys.exit(1)

    json_path = Path(sys.argv[1])

    if not json_path.exists():
        print(f"File not found: {json_path}")
        sys.exit(1)

    try:
        data = json.loads(json_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"Invalid JSON: {e}")
        sys.exit(1)

    if not isinstance(data, list):
        print("Top-level JSON must be an array of projects")
        sys.exit(1)

    errors = []
    seen_ids = set()

    for project in data:
        if not isinstance(project, dict):
            errors.append("Each project must be an object")
            continue

        project_id = project.get("id")
        if project_id in seen_ids:
            errors.append(f"Duplicate project id: {project_id}")
        elif project_id:
            seen_ids.add(project_id)

        validate_project(project, errors)

    if errors:
        print("Validation failed:\n")
        for err in errors:
            print(f"- {err}")
        print(f"\nTotal errors: {len(errors)}")
        sys.exit(1)

    print(f"Validation passed: {len(data)} projects checked successfully.")


if __name__ == "__main__":
    main()
