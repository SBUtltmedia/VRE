"""
normalize_vrma.py - Fix quaternion continuity in VRMA files.

Detects and corrects:
- Sign flips (double-cover) in quaternion animations
- Multi-frame discontinuity regions (interpolates between clean endpoints)

Does NOT modify Hips position or rotation at frame 0.

Usage:
  python python_scripts/normalize_vrma.py vrma/02_01.vrma             # report only
  python python_scripts/normalize_vrma.py vrma/02_01.vrma --write    # write normalized copy
  python python_scripts/normalize_vrma.py vrma/02_01.vrma --write --in-place  # overwrite
"""

import struct
import json
import math
import os
import sys

GLB_MAGIC = b'glTF'
CHUNK_JSON = 0x4E4F534A
CHUNK_BIN  = 0x004E4942


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
                chunks['bin'] = chunk_data
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


def find_hips_node_index(json_data):
    nodes = json_data.get('nodes', [])
    for i, node in enumerate(nodes):
        name = node.get('name', '')
        if name.lower() == 'hips':
            return i
    return None


def accessor_byte_offset(json_data, accessor_idx):
    """Return (byte_offset, component_type, element_count) for an accessor."""
    accessors = json_data.get('accessors', [])
    if accessor_idx < 0 or accessor_idx >= len(accessors):
        return None
    acc = accessors[accessor_idx]
    bv_idx = acc.get('bufferView')
    buffer_views = json_data.get('bufferViews', [])
    if bv_idx is None or bv_idx >= len(buffer_views):
        return None
    bv = buffer_views[bv_idx]
    elem_size = component_byte_size(acc.get('componentType', 5126))
    comp_count = component_count(acc.get('type', 'VEC3'))
    byte_offset = bv.get('byteOffset', 0) + acc.get('byteOffset', 0)
    return (byte_offset, elem_size, comp_count)


def component_byte_size(component_type):
    types = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
    return types.get(component_type, 4)


def component_count(type_str):
    counts = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT2': 4, 'MAT3': 9, 'MAT4': 16}
    return counts.get(type_str, 3)


def read_floats(bin_data, offset, count):
    fmt = '<' + 'f' * count
    return list(struct.unpack_from(fmt, bin_data, offset))


def write_floats(bin_data, offset, values):
    fmt = '<' + 'f' * len(values)
    struct.pack_into(fmt, bin_data, offset, *values)


def quat_conjugate(q):
    return [-q[0], -q[1], -q[2], q[3]]


def quat_multiply(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return [
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
        aw * bw - ax * bx - ay * by - az * bz,
    ]


def quat_normalize(q):
    length = math.sqrt(q[0]**2 + q[1]**2 + q[2]**2 + q[3]**2)
    if length < 1e-10:
        return [0, 0, 0, 1]
    return [v / length for v in q]


def find_hips_channels(json_data, hips_idx):
    """Find Hips animation channels: returns (translation_accessor, rotation_accessor) indices."""
    trans_idx = None
    rot_idx = None
    animations = json_data.get('animations', [])
    for anim in animations:
        channels = anim.get('channels', [])
        samplers = anim.get('samplers', [])
        for ch in channels:
            target = ch.get('target', {})
            node = target.get('node')
            path = target.get('path')
            sampler_idx = ch.get('sampler', 0)
            if node != hips_idx:
                continue
            if sampler_idx < 0 or sampler_idx >= len(samplers):
                continue
            output = samplers[sampler_idx].get('output', -1)
            if path == 'translation':
                trans_idx = output
            elif path == 'rotation':
                rot_idx = output
    return trans_idx, rot_idx


def process_vrma(input_path, do_write=False, in_place=False, threshold_deg=15.0):
    if not os.path.isfile(input_path):
        print(f"Error: File not found: {input_path}")
        return False

    basename = os.path.splitext(os.path.basename(input_path))[0]
    print(f"\n=== VRMA Normalizer ===")
    print(f"File: {os.path.abspath(input_path)}")

    chunks = parse_glb(input_path)
    json_data = chunks['json']
    bin_data = bytearray(chunks['bin'])

    hips_idx = find_hips_node_index(json_data)
    if hips_idx is None:
        print("  No 'Hips' node found.")
        return False

    trans_acc_idx, rot_acc_idx = find_hips_channels(json_data, hips_idx)

    needs_trans = False
    needs_rot = False
    hips_trans_first = None
    hips_rot_first = None
    trans_offset_info = None
    rot_offset_info = None

    # Read first-frame Hips translation
    if trans_acc_idx is not None:
        info = accessor_byte_offset(json_data, trans_acc_idx)
        if info:
            trans_offset_info = info
            byte_off, elem_sz, comp_cnt = info
            values = read_floats(bin_data, byte_off, comp_cnt)
            hips_trans_first = values[:3]
            x, y, z = hips_trans_first
            dist_xz = math.sqrt(x*x + z*z)
            dist_3d = math.sqrt(x*x + y*y + z*z)
            print(f"\n  Hips translation at frame 0:")
            print(f"    X {x:+.6f}  Y {y:+.6f}  Z {z:+.6f}")
            print(f"    XZ distance from origin: {dist_xz:.6f}m  total 3D: {dist_3d:.6f}m")
            needs_trans = abs(x) > 1e-6 or abs(y) > 1e-6 or abs(z) > 1e-6

    # Read first-frame Hips rotation
    if rot_acc_idx is not None:
        info = accessor_byte_offset(json_data, rot_acc_idx)
        if info:
            rot_offset_info = info
            byte_off, elem_sz, comp_cnt = info
            values = read_floats(bin_data, byte_off, comp_cnt)
            hips_rot_first = values[:4]
            angle = 2 * math.acos(min(1, abs(hips_rot_first[3]))) * 57.2958
            print(f"\n  Hips rotation at frame 0:")
            print(f"    ({', '.join(f'{v:.6f}' for v in hips_rot_first)})")
            print(f"    Angle from identity: {angle:.2f}°")
            needs_rot = angle > 0.01

    if not needs_trans and not needs_rot:
        print(f"\n  [OK] Hips is already at origin with identity rotation.")

    print(f"\n  {'[!] Position needs normalization' if needs_trans else '[OK] Position OK'}  "
          f"{'[!] Rotation needs normalization' if needs_rot else '[OK] Rotation OK'}")

    # Quaternion continuity: fix sign flips and interpolate 180° discontinuities
    total_sign_fixed = 0
    total_interp = 0
    if do_write:
        total_interp = 0
        # Convert threshold_deg to quaternion dot threshold
        # For quaternions, angle_between = 2*acos(|dot|)
        # So threshold at angle θ means |dot| < cos(θ/2)
        thresh_dot = math.cos(math.radians(threshold_deg / 2))
        for anim in json_data.get('animations', []):
            for sampler in anim.get('samplers', []):
                output_idx = sampler.get('output', -1)
                if output_idx < 0 or output_idx >= len(json_data.get('accessors', [])):
                    continue
                acc = json_data['accessors'][output_idx]
                if acc.get('type') != 'VEC4' or acc.get('componentType') != 5126:
                    continue
                info = accessor_byte_offset(json_data, output_idx)
                if not info:
                    continue
                byte_off, elem_sz, comp_cnt = info
                if comp_cnt < 4:
                    continue
                count = acc.get('count', 0)
                # Read all quaternions for this accessor
                quats = []
                for i in range(count):
                    off = byte_off + i * elem_sz * comp_cnt
                    quats.append(read_floats(bin_data, off, 4))
                # Pass 1: fix sign flips (dot < 0 = double-cover)
                for i in range(1, count):
                    dot = sum(quats[i-1][j]*quats[i][j] for j in range(4))
                    if dot < 0:
                        quats[i] = [-quats[i][0], -quats[i][1], -quats[i][2], -quats[i][3]]
                        total_sign_fixed += 1
                # Pass 2: detect and interpolate discontinuity edges
                bad_edges = [False] * (count - 1)
                for i in range(count - 1):
                    dot = sum(quats[i][j]*quats[i+1][j] for j in range(4))
                    if abs(dot) < thresh_dot:
                        bad_edges[i] = True
                # Group consecutive bad edges into regions
                # A region spans frames [r_start, r_end] where all internal edges are bad
                # but the edges entering and leaving the region are clean
                in_region = False
                r_start = 0
                for i in range(count - 1):
                    if bad_edges[i] and not in_region:
                        in_region = True
                        r_start = i
                    elif not bad_edges[i] and in_region:
                        in_region = False
                        r_end = i + 1
                        prev = r_start - 1
                        next_f = r_end + 1
                        if prev >= 0 and next_f < count:
                            qa = quats[prev]
                            qb = quats[next_f]
                            if sum(qa[j]*qb[j] for j in range(4)) < 0:
                                qb = [-qb[0], -qb[1], -qb[2], -qb[3]]
                            dot_ab = sum(qa[j]*qb[j] for j in range(4))
                            dot_ab = min(1, max(-1, dot_ab))
                            theta = math.acos(dot_ab)
                            sin_theta = math.sin(theta)
                            n_frames = r_end - r_start + 1
                            for k in range(n_frames):
                                fidx = r_start + k
                                t = (k + 1) / (n_frames + 1)
                                if sin_theta > 1e-8:
                                    w0 = math.sin((1-t)*theta) / sin_theta
                                    w1 = math.sin(t*theta) / sin_theta
                                    qi = [w0*qa[j] + w1*qb[j] for j in range(4)]
                                else:
                                    qi = [(qa[j]+qb[j])*0.5 for j in range(4)]
                                length = math.sqrt(sum(v*v for v in qi))
                                if length > 1e-10:
                                    quats[fidx] = [v/length for v in qi]
                                    total_interp += 1
                # Handle case where region extends to the end of the animation
                if in_region:
                    r_end = count - 1
                    prev = r_start - 1
                    if prev >= 0:
                        qa = quats[prev]
                        qb = quats[r_end]
                        if sum(qa[j]*qb[j] for j in range(4)) < 0:
                            qb = [-qb[0], -qb[1], -qb[2], -qb[3]]
                        dot_ab = sum(qa[j]*qb[j] for j in range(4))
                        dot_ab = min(1, max(-1, dot_ab))
                        theta = math.acos(dot_ab)
                        sin_theta = math.sin(theta)
                        for k in range(r_end - r_start + 1):
                            fidx = r_start + k
                            t = (k + 1) / (r_end - r_start + 2)
                            if sin_theta > 1e-8:
                                w0 = math.sin((1-t)*theta) / sin_theta
                                w1 = math.sin(t*theta) / sin_theta
                                qi = [w0*qa[j] + w1*qb[j] for j in range(4)]
                            else:
                                qi = [(qa[j]+qb[j])*0.5 for j in range(4)]
                            length = math.sqrt(sum(v*v for v in qi))
                            if length > 1e-10:
                                quats[fidx] = [v/length for v in qi]
                                total_interp += 1
                # Write back
                for i in range(count):
                    off = byte_off + i * elem_sz * comp_cnt
                    write_floats(bin_data, off, quats[i])
        if total_sign_fixed > 0:
            print(f"  Quaternion continuity: fixed {total_sign_fixed} sign flips")
        if total_interp > 0:
            print(f"  Quaternion continuity: interpolated {total_interp} frames (threshold {threshold_deg}°)"  )

    any_change = total_sign_fixed > 0 or total_interp > 0

    if do_write and any_change:
        out_path = input_path if in_place else os.path.join(
            os.path.dirname(input_path), f"{basename}_normalized.vrma")
        write_glb(out_path, json_data, bytes(bin_data))
        print(f"\n  [OK] Written: {os.path.abspath(out_path)}")
    elif do_write and not any_change:
        print(f"\n  (no changes needed, skipping write)")

    print()
    return True


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Normalize first-frame Hips offset in VRMA files')
    parser.add_argument('input', help='Path to VRMA file')
    parser.add_argument('--write', action='store_true', help='Write normalized file')
    parser.add_argument('--in-place', action='store_true', help='Overwrite original (only with --write)')
    parser.add_argument('--threshold', type=float, default=15.0,
        help='Discontinuity threshold in degrees (default: 15.0)')
    args = parser.parse_args()

    success = process_vrma(args.input, do_write=args.write, in_place=getattr(args, 'in_place', False),
                           threshold_deg=args.threshold)
    sys.exit(0 if success else 1)
