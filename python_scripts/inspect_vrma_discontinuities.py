"""
Inspect VRMA (GLB) files for quaternion discontinuities between consecutive frames.
Usage: blender --background --python inspect_vrma_discontinuities.py -- <vrma_path> [threshold_deg]
   Or: python inspect_vrma_discontinuities.py <vrma_path> [threshold_deg]
"""
import struct
import json
import sys
import os
from math import acos, sqrt, pi

THRESHOLD_DEG = 15.0

def parse_glb(file_path):
    with open(file_path, 'rb') as f:
        magic = f.read(4)
        if magic != b'glTF':
            raise ValueError("Not a GLB file")
        version = struct.unpack('<I', f.read(4))[0]
        length = struct.unpack('<I', f.read(4))[0]
        chunks = []
        while f.tell() < length:
            chunk_len = struct.unpack('<I', f.read(4))[0]
            chunk_type = struct.unpack('<I', f.read(4))[0]
            chunk_data = f.read(chunk_len)
            chunks.append({'type': chunk_type, 'data': chunk_data})
    return chunks

def accessor_data(gltf, accessor_idx, bin_data):
    acc = gltf['accessors'][accessor_idx]
    bv = gltf['bufferViews'][acc['bufferView']]
    component_size = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}[acc['componentType']]
    num_components = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT2': 4, 'MAT3': 9, 'MAT4': 16}[acc['type']]
    stride = bv.get('byteStride', component_size * num_components)
    offset = bv['byteOffset'] + acc.get('byteOffset', 0)
    count = acc['count']
    fmt = {5126: 'f', 5123: 'H', 5122: 'h', 5121: 'B', 5120: 'b', 5125: 'I'}[acc['componentType']]
    import struct as st
    out = []
    for i in range(count):
        byte_start = offset + i * stride
        chunk = bin_data[byte_start:byte_start + component_size * num_components]
        vals = st.unpack('<' + fmt * num_components, chunk)
        if num_components == 1:
            out.append(vals[0])
        else:
            out.append(vals)
    return out

def quat_dot(a, b):
    return abs(a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3])

def quat_angle_deg(a, b):
    dot = min(1.0, quat_dot(a, b))
    return 2 * acos(dot) * 180.0 / pi

def analyze_vrma(file_path, threshold_deg=THRESHOLD_DEG):
    basename = os.path.basename(file_path)
    print(f"\n{'='*60}")
    print(f"File: {basename}")
    print(f"{'='*60}")

    chunks = parse_glb(file_path)
    json_chunk = next((c for c in chunks if c['type'] == 0x4E4F534A), None)
    bin_chunk = next((c for c in chunks if c['type'] == 0x004E4942), None)
    if not json_chunk or not bin_chunk:
        print("  ERROR: Missing JSON or BIN chunk")
        return

    gltf = json.loads(json_chunk['data'].decode('utf-8'))
    bin_data = bin_chunk['data']
    nodes = gltf.get('nodes', [])
    anims = gltf.get('animations', [])
    if not anims:
        print("  No animations found")
        return

    total_bad_frames = 0
    worst_overall = 0
    worst_overall_info = None

    for anim_idx, anim in enumerate(anims):
        if len(anims) > 1:
            print(f"\n  Animation {anim_idx}: {anim.get('name', 'unnamed')}")
        channels = anim.get('channels', [])
        samplers = anim.get('samplers', [])

        for ch in channels:
            target = ch.get('target', {})
            node_idx = target.get('node')
            path = target.get('path', '')
            if path != 'rotation':
                continue
            sampler = samplers[ch['sampler']]
            input_acc = accessor_data(gltf, sampler['input'], bin_data)
            output_acc = accessor_data(gltf, sampler['output'], bin_data)
            node_name = nodes[node_idx].get('name', f'Node_{node_idx}') if node_idx is not None else 'unknown'

            if len(output_acc) < 2:
                continue

            max_deg = 0
            max_frame = 0
            bad_frames = []
            for i in range(1, len(output_acc)):
                q_prev = output_acc[i - 1]
                q_cur = output_acc[i]
                deg = quat_angle_deg(q_prev, q_cur)
                if deg == 0:
                    continue
                if deg > max_deg:
                    max_deg = deg
                    max_frame = i
                if deg >= threshold_deg:
                    bad_frames.append((i, deg))

            if bad_frames:
                total_bad_frames += len(bad_frames)
                if max_deg > worst_overall:
                    worst_overall = max_deg
                    worst_overall_info = (node_name, basename)

                if len(bad_frames) <= 10:
                    for fr, d in bad_frames:
                        print(f"    {node_name}: frame {fr} -> {fr+1}: {d:.1f}°")
                else:
                    print(f"    {node_name}: {len(bad_frames)} bad frames, max {max_deg:.1f}° at frame {max_frame}")
                    # Show worst 5
                    bad_frames.sort(key=lambda x: -x[1])
                    for fr, d in bad_frames[:5]:
                        print(f"      frame {fr} -> {fr+1}: {d:.1f}°")

    if total_bad_frames == 0:
        print(f"  No discontinuities > {threshold_deg}° found — animation is smooth")
    else:
        print(f"\n  Total: {total_bad_frames} frame discontinuities > {threshold_deg}°")

    return {
        'file': basename,
        'total_bad_frames': total_bad_frames,
        'worst_deg': worst_overall,
        'worst_bone': worst_overall_info[0] if worst_overall_info else None,
    }

if __name__ == '__main__':
    args = sys.argv[1:]
    # Handle Blender '--' separator
    if '--' in args:
        args = args[args.index('--') + 1:]
    if not args:
        print("Usage: python inspect_vrma_discontinuities.py <vrma_path> [threshold_deg]")
        print("   Or: blender --background --python inspect_vrma_discontinuities.py -- <vrma_path>")
        sys.exit(1)

    path = args[0]
    thresh = float(args[1]) if len(args) > 1 else THRESHOLD_DEG

    if os.path.isdir(path):
        # Scan all .vrma files in directory
        results = []
        for f in sorted(os.listdir(path)):
            if f.endswith('.vrma'):
                r = analyze_vrma(os.path.join(path, f), thresh)
                if r:
                    results.append(r)
        print(f"\n{'='*60}")
        print("SUMMARY")
        print(f"{'='*60}")
        bad = [r for r in results if r['total_bad_frames'] > 0]
        clean = [r for r in results if r['total_bad_frames'] == 0]
        print(f"  Scanned {len(results)} VRMA files")
        print(f"  Clean (no discontinuities > {thresh}°): {len(clean)}")
        print(f"  With discontinuities: {len(bad)}")
        if bad:
            print(f"\n  Worst files:")
            bad.sort(key=lambda r: -r['worst_deg'])
            for r in bad[:10]:
                print(f"    {r['file']}: {r['total_bad_frames']} frames, max {r['worst_deg']:.1f}° ({r['worst_bone']})")
    else:
        analyze_vrma(path, thresh)
