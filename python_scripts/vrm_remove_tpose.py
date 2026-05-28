"""
vrm_remove_tpose.py - Remove T-pose calibration frame (keyframe 0) from VRMA animations.

Some VRMA pipelines insert a T-pose or A-pose at time 0.0 as a calibration step.
This causes a jarring 1-frame pop at the start of playback. This script strips
that first keyframe from all animation channels.

Usage:
  python vrm_remove_tpose.py vrma/114_05.vrma              # in-place
  python vrm_remove_tpose.py vrma/114_05.vrma -o fixed.vrma # to new file
  python vrm_remove_tpose.py vrma/*.vrma                    # batch in-place
"""

import struct
import json
import os
import sys
import argparse
import copy

GLB_MAGIC = b'glTF'
CHUNK_JSON = 0x4E4F534A
CHUNK_BIN = 0x004E4942

COMPONENT_BYTES = {
    5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4,
}

TYPE_COUNT = {
    'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4,
    'MAT2': 4, 'MAT3': 9, 'MAT4': 16,
}


def parse_glb(filepath):
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
                chunks['bin'] = bytearray(chunk_data)
        return chunks


def write_glb(filepath, json_data, bin_data):
    json_bytes = json.dumps(json_data, separators=(',', ':')).encode('utf-8')
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


def elem_size(accessor):
    comp = accessor.get('componentType', 5126)
    return COMPONENT_BYTES.get(comp, 4) * TYPE_COUNT.get(accessor.get('type', 'SCALAR'), 1)


def read_value(bin_data, accessor, buffer_view, index):
    """Read a single element value from an accessor at the given index."""
    stride = elem_size(accessor)
    offset = buffer_view.get('byteOffset', 0) + accessor.get('byteOffset', 0) + index * stride
    n = TYPE_COUNT.get(accessor.get('type', 'SCALAR'), 1)
    fmt = '<' + 'f' * n
    return list(struct.unpack_from(fmt, bin_data, offset))


def remove_first_keyframe(json_data, bin_data):
    """Remove the keyframe at time 0.0 from all animation samplers."""
    json_data = copy.deepcopy(json_data)
    bin_data = bytearray(bin_data)

    accessors = json_data.get('accessors', [])
    buffer_views = json_data.get('bufferViews', [])
    animations = json_data.get('animations', [])
    modified_bvs = set()
    sampler_count = 0

    for anim in animations:
        for sampler in anim.get('samplers', []):
            input_idx = sampler.get('input')
            output_idx = sampler.get('output')
            if input_idx is None or output_idx is None:
                continue

            input_acc = accessors[input_idx]
            output_acc = accessors[output_idx]

            if input_acc.get('count', 0) < 2:
                continue

            in_bv_idx = input_acc.get('bufferView')
            out_bv_idx = output_acc.get('bufferView')
            if in_bv_idx is None or out_bv_idx is None:
                continue

            in_bv = buffer_views[in_bv_idx]
            out_bv = buffer_views[out_bv_idx]

            # Check first time value is 0.0
            abs_offset = in_bv.get('byteOffset', 0) + input_acc.get('byteOffset', 0)
            first_val = struct.unpack_from('<f', bin_data, abs_offset)[0]
            if first_val != 0.0:
                continue

            in_elem = elem_size(input_acc)
            out_elem = elem_size(output_acc)

            # Advance buffer view offsets past the first element (shared with accessor)
            in_bv['byteOffset'] = in_bv.get('byteOffset', 0) + in_elem
            in_bv['byteLength'] = in_bv['byteLength'] - in_elem
            modified_bvs.add(in_bv_idx)

            out_bv['byteOffset'] = out_bv.get('byteOffset', 0) + out_elem
            out_bv['byteLength'] = out_bv['byteLength'] - out_elem
            modified_bvs.add(out_bv_idx)

            # Update accessor count and min/max (byteOffset stays relative to BV)
            old_in_count = input_acc['count']
            input_acc['count'] = old_in_count - 1
            if old_in_count > 1:
                new_first = read_value(bin_data, input_acc, in_bv, 0)[0]
                new_last = read_value(bin_data, input_acc, in_bv, old_in_count - 2)[0]
                input_acc['min'] = [new_first]
                input_acc['max'] = [new_last]

            old_out_count = output_acc['count']
            output_acc['count'] = old_out_count - 1
            if old_out_count > 1:
                new_first_v = read_value(bin_data, output_acc, out_bv, 0)
                new_last_v = read_value(bin_data, output_acc, out_bv, old_out_count - 2)
                output_acc['min'] = [min(a, b) for a, b in zip(new_first_v, new_last_v)]
                output_acc['max'] = [max(a, b) for a, b in zip(new_first_v, new_last_v)]

            sampler_count += 1

    return json_data, bin_data, sampler_count


def process_file(input_path, output_path=None):
    if output_path is None:
        output_path = input_path

    print(f"Processing: {input_path}")
    chunks = parse_glb(input_path)
    if 'json' not in chunks or 'bin' not in chunks:
        print("  Error: Invalid VRMA file")
        return False

    modified_json, modified_bin, removed = remove_first_keyframe(
        chunks['json'], chunks['bin'])

    if removed == 0:
        print("  No T-pose frame found (no keyframe at time 0.0)")
        if output_path != input_path:
            import shutil
            shutil.copy2(input_path, output_path)
            print(f"  Copied unchanged to: {output_path}")
        return True

    write_glb(output_path, modified_json, bytes(modified_bin))
    old_size = os.path.getsize(input_path) if os.path.exists(input_path) else 0
    new_size = os.path.getsize(output_path)
    print(f"  Stripped {removed} sampler start-frames (T-pose)")
    print(f"  Written: {output_path} ({new_size} bytes, was {old_size})")
    return True


def main():
    parser = argparse.ArgumentParser(
        description='Remove T-pose calibration frame from VRMA animations')
    parser.add_argument('input', nargs='+', help='VRMA file(s) to process')
    parser.add_argument('-o', '--output', help='Output file (only with single input)')
    args = parser.parse_args()

    if args.output and len(args.input) > 1:
        print("Error: --output can only be used with a single input file")
        sys.exit(1)

    ok = True
    for p in args.input:
        if not os.path.isfile(p):
            print(f"Error: File not found: {p}")
            ok = False
            continue
        if not process_file(p, args.output):
            ok = False

    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
