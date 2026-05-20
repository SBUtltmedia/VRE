#!/usr/bin/env python3
"""
buildengine.py - Agnostic Workspace Compiler & Patch Deployment Tool

This script simplifies collaborative edits by providing two modes:
  1. Decompile (Default): Read a patch JSON manifest and apply file creations/diffs.
  2. Compile: Scan local text assets and bundle them into a single patch.json style file.
"""

import os
import json
import argparse
import re

# File and directory exclusion rules for the compilation scan
IGNORE_DIRS = {
    ".git", "__pycache__", ".venv", "venv", "env", 
    "node_modules", ".vscode", ".idea"
}
IGNORE_FILES = {
    "buildengine.py", "applyPatch.py", "apply_patch.py", 
    "out.json", "patch.json", "traffic_scene.json"
}
# Only text-based assets will be scanned during compilation
ALLOWED_EXTENSIONS = {
    ".js", ".html", ".css", ".md", ".txt", ".json"
}

def clean_content(content: str) -> str:
    """Normalize line endings to standard Unix line feeds."""
    return content.replace("\r\n", "\n").strip() + "\n"

def compile_workspace(src_dir=".", output_file="out.json"):
    """
    Scans the source directory recursively, filters out binary, git, and script
    assets, and serializes all eligible text assets into a single patch manifest.
    """
    print(f"📦 Compiling workspace text assets from: {os.path.abspath(src_dir)}")
    patches = []

    for root, dirs, files in os.walk(src_dir):
        # Modify dirs in-place to skip ignored directories recursively
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]

        for file in files:
            if file in IGNORE_FILES:
                continue

            filepath = os.path.relpath(os.path.join(root, file), src_dir)
            # Normalize backward slashes for cross-platform consistency
            normalized_path = filepath.replace("\\", "/")

            _, ext = os.path.splitext(file)
            if ext.lower() not in ALLOWED_EXTENSIONS:
                continue

            try:
                with open(os.path.join(root, file), "r", encoding="utf-8") as f:
                    content = f.read()
                
                patches.append({
                    "filepath": normalized_path,
                    "action": "create",
                    "content": clean_content(content)
                })
                print(f"  + Bundled: {normalized_path}")
            except Exception as e:
                print(f"  ⚠️  Skipping: {normalized_path} (could not read as UTF-8 text: {e})")

    manifest = {"patches": patches}

    try:
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)
        print(f"\n🎉 Compilation successful! Created unified manifest: {output_file} ({len(patches)} files bundled)")
    except Exception as e:
        print(f"❌ Error writing manifest: {e}")


def decompile_patch(manifest_path="patch.json"):
    """
    Reads a patch manifest and performs surgical updates or file creations
    across the workspace directory.
    """
    if not os.path.exists(manifest_path):
        print(f"❌ Error: Manifest file '{manifest_path}' not found.")
        return

    print(f"🚀 Deploying patch manifest: {os.path.abspath(manifest_path)}")

    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
    except Exception as e:
        print(f"❌ JSON Parsing Error: The manifest contains formatting errors: {e}")
        return

    for file_patch in manifest.get("patches", []):
        filepath = file_patch.get("filepath")
        action = file_patch.get("action", "patch")
        
        if not filepath:
            continue

        # Ensure directory folders exist automatically
        dir_name = os.path.dirname(filepath)
        if dir_name and not os.path.exists(dir_name):
            os.makedirs(dir_name, exist_ok=True)

        # Handle complete file generation / override
        if action == "create":
            content = file_patch.get("content", "")
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(clean_content(content))
            print(f"  ✓ Created/Overwrote: {filepath}")
            continue

        # Handle surgical differential regex modifications
        if action == "patch" or not action:
            if not os.path.exists(filepath):
                print(f"  ⚠️  Warning: Target file '{filepath}' missing. Skipping patch.")
                continue

            with open(filepath, "r", encoding="utf-8") as f:
                file_content = f.read()

            modifications = file_patch.get("diffs", [])
            success_count = 0

            for mod in modifications:
                search_block = mod.get("find", "")
                replace_block = mod.get("replace", "")

                if not search_block:
                    continue

                # Escape regex tokens while making whitespace requirements flexible
                escaped_search = re.escape(search_block.strip())
                flexible_search = re.sub(r'\\s+', r'\\s*', escaped_search)

                if re.search(flexible_search, file_content):
                    file_content = re.sub(flexible_search, replace_block.strip(), file_content, count=1)
                    success_count += 1
                else:
                    print(f"  ❌ Error matching code block inside '{filepath}' for:\n{search_block[:80]}...")

            with open(filepath, "w", encoding="utf-8") as f:
                f.write(file_content)
                
            print(f"  ✓ Patched: {filepath} ({success_count}/{len(modifications)} blocks updated)")

    print("\n🎉 Deployment execution complete! Workspace synchronization complete.")


def main():
    parser = argparse.ArgumentParser(
        description="buildengine.py - Unified Workspace Compiler and Decompiler"
    )
    
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "-d", "--decompile",
        action="store_true",
        help="Decompile / apply a patch manifest to individual files (Default Mode)"
    )
    group.add_argument(
        "-c", "--compile",
        action="store_true",
        help="Compile all local workspace text assets into a unified manifest"
    )

    parser.add_argument(
        "-i", "--input",
        type=str,
        default=None,
        help="Input path (manifest file for decompiling, folder path for compiling)"
    )
    parser.add_argument(
        "-o", "--output",
        type=str,
        default=None,
        help="Output path (destination file for compilation)"
    )

    args = parser.parse_args()

    # Determine execution route based on passed arguments
    if args.compile:
        src = args.input if args.input else "."
        out = args.output if args.output else "out.json"
        compile_workspace(src_dir=src, output_file=out)
    else:
        # Default behavior: Decompile / apply patch
        inp = args.input if args.input else "patch.json"
        decompile_patch(manifest_path=inp)

if __name__ == "__main__":
    main()
