"""
vrm_replace_incorrect.py - Replace incorrect VRMA files and clean up artifacts.

Replaces specified VRMA files with corrected versions (e.g., replaces a broken
VRMA with animation data sourced from a known-good VRMA). Also removes old
split-file artifacts from the VRMA/split/ directory.

Usage:
  python vrm_replace_incorrect.py VRMA/split              # remove split dir
  python vrm_replace_incorrect.py VRMA/114_05.vrma --source VRMA/75_17.vrma
"""

import os
import sys
import shutil
import argparse


def remove_split_directory(split_path):
    """Remove the VRMA split directory and all its contents."""
    if not os.path.isdir(split_path):
        print(f"Split directory not found: {split_path}")
        return False

    count = len(os.listdir(split_path))
    shutil.rmtree(split_path)
    print(f"Removed split directory: {split_path} ({count} files)")
    return True


def replace_vrma(target_path, source_path, backup=False):
    """Replace a VRMA file with animation data from another VRMA source.

    If the source is a VRMA, copies the source over the target (in-place replace).
    Creates backup of the original target if backup=True.
    """
    if not os.path.isfile(target_path):
        print(f"Error: Target not found: {target_path}")
        return False
    if not os.path.isfile(source_path):
        print(f"Error: Source not found: {source_path}")
        return False
    if target_path == source_path:
        print(f"Error: Target and source are the same file")
        return False

    if backup:
        backup_path = target_path + '.bak'
        shutil.copy2(target_path, backup_path)
        print(f"  Backup: {backup_path}")

    shutil.copy2(source_path, target_path)
    t_size = os.path.getsize(target_path)
    s_size = os.path.getsize(source_path)
    print(f"  Replaced: {target_path}")
    print(f"    Source:  {source_path} ({s_size} bytes)")
    print(f"    Target:  {t_size} bytes")
    return True


def main():
    parser = argparse.ArgumentParser(
        description='Replace incorrect VRMA files and clean up artifacts')
    parser.add_argument('target', nargs='+',
                        help='Target VRMA file(s) or "split" to remove split directory')
    parser.add_argument('--source', '-s',
                        help='Source VRMA file to replace target(s) with')
    parser.add_argument('--backup', '-b', action='store_true',
                        help='Backup original target files before replacing')
    args = parser.parse_args()

    success = True

    for target in args.target:
        normalized = target.replace('/', os.sep)

        if normalized == 'VRMA\\split' or normalized == 'VRMA/split':
            remove_split_directory(normalized)
            continue

        if args.source:
            if not replace_vrma(target, args.source, backup=args.backup):
                success = False
        else:
            print(f"No --source specified for {target}, skipping")

    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
