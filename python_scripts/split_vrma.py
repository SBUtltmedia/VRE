"""
split_vrma.py - Split a VRMA file into root and body layers.

Usage:
  python split_vrma.py vrma/81_04.vrma
  python split_vrma.py vrma/81_04.vrma --output-dir vrma/split

Root layer:  Hips translation channels only (root motion)
Body layer:  All channels EXCEPT Hips translation (bone rotations, no root motion)

This works by parsing the GLB binary, filtering animation channels in the JSON
metadata, and writing new GLB files. The binary buffer data is preserved as-is;
unused accessor data is simply no longer referenced.
"""

import struct
import json
import os
import sys
import argparse


GLB_MAGIC = b'glTF'
CHUNK_JSON = 0x4E4F534A
CHUNK_BIN  = 0x004E4942


def parse_glb(filepath):
    """Parse a GLB file into its JSON and binary chunks."""
    with open(filepath, 'rb') as f:
        magic = f.read(4)
        if magic != GLB_MAGIC:
            raise ValueError(f"Not a GLB file: {filepath}")

        version, total_length = struct.unpack('<II', f.read(8))
        if version != 2:
            raise ValueError(f"Expected GLB v2, got v{version}")

        chunks = {}
        while True:
            header = f.read(8)
            if len(header) < 8:
                break
            chunk_length, chunk_type = struct.unpack('<II', header)
            chunk_data = f.read(chunk_length)
            if len(chunk_data) < chunk_length:
                break

            if chunk_type == CHUNK_JSON:
                chunks['json'] = json.loads(chunk_data.decode('utf-8'))
            elif chunk_type == CHUNK_BIN:
                chunks['bin'] = chunk_data

        return chunks


def write_glb(filepath, json_data, bin_data):
    """Write a GLB file from JSON metadata and binary buffer."""
    json_bytes = json.dumps(json_data, separators=(',', ':')).encode('utf-8')
    # JSON chunk must be 4-byte aligned
    json_padding = (4 - len(json_bytes) % 4) % 4
    json_bytes += b' ' * json_padding

    bin_padding = (4 - len(bin_data) % 4) % 4
    bin_data_padded = bin_data + b'\x00' * bin_padding

    total_length = 12 + 8 + len(json_bytes) + 8 + len(bin_data_padded)

    with open(filepath, 'wb') as f:
        f.write(GLB_MAGIC)
        f.write(struct.pack('<II', 2, total_length))

        f.write(struct.pack('<II', len(json_bytes), CHUNK_JSON))
        f.write(json_bytes)

        f.write(struct.pack('<II', len(bin_data_padded), CHUNK_BIN))
        f.write(bin_data_padded)


def find_hips_node_index(json_data):
    """Find the node index for the Hips bone."""
    nodes = json_data.get('nodes', [])
    for i, node in enumerate(nodes):
        name = node.get('name', '')
        if name.lower() == 'hips':
            return i
    return None


def split_channels(json_data, hips_idx, mode):
    """
    Filter animation channels based on mode.

    mode='root':  Keep only Hips translation channels
    mode='body':  Keep everything EXCEPT Hips translation
    """
    animations = json_data.get('animations', [])
    if not animations:
        return json_data

    new_json = json.loads(json.dumps(json_data))

    for anim in new_json.get('animations', []):
        channels = anim.get('channels', [])
        samplers = anim.get('samplers', [])

        filtered_channels = []
        used_sampler_indices = set()

        for ch in channels:
            node_idx = ch.get('target', {}).get('node')
            path = ch.get('target', {}).get('path')
            sampler_idx = ch.get('sampler')

            is_hips_translation = (node_idx == hips_idx and path == 'translation')

            if mode == 'root':
                keep = is_hips_translation
            elif mode == 'body':
                keep = not is_hips_translation
            else:
                keep = True

            if keep:
                filtered_channels.append(ch)
                if sampler_idx is not None:
                    used_sampler_indices.add(sampler_idx)

        anim['channels'] = filtered_channels

        # Remap sampler indices to be contiguous
        sampler_map = {old: new for new, old in enumerate(sorted(used_sampler_indices))}
        for ch in anim['channels']:
            if ch.get('sampler') is not None:
                ch['sampler'] = sampler_map[ch['sampler']]

        # Keep only used samplers (remapped)
        new_samplers = []
        for old_idx in sorted(used_sampler_indices):
            if old_idx < len(samplers):
                new_samplers.append(samplers[old_idx])
        anim['samplers'] = new_samplers

    return new_json


def split_vrma(input_path, output_dir=None):
    """Split a VRMA into root and body layers."""
    if not os.path.isfile(input_path):
        print(f"Error: File not found: {input_path}")
        return False

    if output_dir is None:
        output_dir = os.path.join(os.path.dirname(input_path), 'split')

    os.makedirs(output_dir, exist_ok=True)

    basename = os.path.splitext(os.path.basename(input_path))[0]

    print(f"Loading: {input_path}")
    chunks = parse_glb(input_path)

    if 'json' not in chunks:
        print("Error: No JSON chunk found in VRMA")
        return False
    if 'bin' not in chunks:
        print("Error: No binary chunk found in VRMA")
        return False

    json_data = chunks['json']
    bin_data = chunks['bin']

    animations = json_data.get('animations', [])
    total_channels = sum(len(a.get('channels', [])) for a in animations)
    print(f"  Found {total_channels} animation channels")

    hips_idx = find_hips_node_index(json_data)
    if hips_idx is None:
        print("  Warning: No 'Hips' node found. Copying original for both layers.")
        root_json = json_data
        body_json = json_data
    else:
        print(f"  Hips node index: {hips_idx}")
        root_json = split_channels(json_data, hips_idx, 'root')
        body_json = split_channels(json_data, hips_idx, 'body')

    root_channels = sum(len(a.get('channels', [])) for a in root_json.get('animations', []))
    body_channels = sum(len(a.get('channels', [])) for a in body_json.get('animations', []))

    root_path = os.path.join(output_dir, f"{basename}_root.vrma")
    body_path = os.path.join(output_dir, f"{basename}_body.vrma")

    print(f"  Writing root ({root_channels} channels): {root_path}")
    write_glb(root_path, root_json, bin_data)

    print(f"  Writing body ({body_channels} channels): {body_path}")
    write_glb(body_path, body_json, bin_data)

    print(f"  Done. Root: {os.path.getsize(root_path)} bytes, Body: {os.path.getsize(body_path)} bytes")
    return True


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Split VRMA into root and body layers')
    parser.add_argument('input', help='Path to VRMA file')
    parser.add_argument('--output-dir', '-o', help='Output directory (default: vrma/split/)')
    args = parser.parse_args()

    success = split_vrma(args.input, args.output_dir)
    sys.exit(0 if success else 1)
