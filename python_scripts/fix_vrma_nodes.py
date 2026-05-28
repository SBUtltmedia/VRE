"""
fix_vrma_nodes.py - Zero node rotations/translations in VRMA, adjust keyframes.

Keeps VRM_Character wrapper (zeroed) for loader compatibility.

Usage:
  python fix_vrma_nodes.py <input.vrma> --in-place
"""

import struct, json, math, os, sys

GLB_MAGIC = b'glTF'
CHUNK_JSON = 0x4E4F534A
CHUNK_BIN  = 0x004E4942

def parse_glb(fp):
    with open(fp, 'rb') as f:
        if f.read(4) != GLB_MAGIC: raise ValueError("Not a GLB")
        f.read(8)
        chunks = {}
        while True:
            h = f.read(8)
            if len(h) < 8: break
            cl, ct = struct.unpack('<II', h)
            d = f.read(cl)
            if ct == CHUNK_JSON: chunks['json'] = json.loads(d.decode('utf-8'))
            elif ct == CHUNK_BIN: chunks['bin'] = d
    return chunks

def write_glb(fp, jd, bd):
    jb = json.dumps(jd, separators=(',', ':')).encode('utf-8')
    jb += b' ' * ((4 - len(jb) % 4) % 4)
    bp = bd + b'\x00' * ((4 - len(bd) % 4) % 4)
    tl = 12 + 8 + len(jb) + 8 + len(bp)
    with open(fp, 'wb') as f:
        f.write(GLB_MAGIC)
        f.write(struct.pack('<II', 2, tl))
        f.write(struct.pack('<II', len(jb), CHUNK_JSON))
        f.write(jb)
        f.write(struct.pack('<II', len(bp), CHUNK_BIN))
        f.write(bp)

def rf(bd, off, n):
    return list(struct.unpack_from('<' + 'f' * n, bd, off))

def wf(bd, off, vals):
    struct.pack_into('<' + 'f' * len(vals), bd, off, *vals)

def qmult(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return [aw*bx + ax*bw + ay*bz - az*by,
            aw*by - ax*bz + ay*bw + az*bx,
            aw*bz + ax*by - ay*bx + az*bw,
            aw*bw - ax*bx - ay*by - az*bz]

def qconj(q):
    return [-q[0], -q[1], -q[2], q[3]]

def qnorm(q):
    l = math.sqrt(sum(v*v for v in q))
    if l < 1e-10: return [0,0,0,1]
    return [v/l for v in q]

def main():
    input_path = sys.argv[1]
    in_place = '--in-place' in sys.argv

    chunks = parse_glb(input_path)
    jd = chunks['json']
    bd = bytearray(chunks['bin'])
    nodes = jd.get('nodes', [])

    # Remove VRM_Character wrapper from scene nodes (Hips becomes root)
    # but keep it in nodes array to preserve indices.
    scene = jd.get('scene', 0)
    scenes = jd.get('scenes', [])
    root_idx = None
    for i, n in enumerate(nodes):
        if n.get('name') == 'VRM_Character':
            root_idx = i
            break
    if root_idx is not None and scenes and scene < len(scenes):
        scene_nodes = scenes[scene].get('nodes', [])
        if root_idx in scene_nodes:
            # Promote VRM_Character's children to scene root
            children = nodes[root_idx].get('children', [])
            new_scene_nodes = [n for n in scene_nodes if n != root_idx] + children
            scenes[scene]['nodes'] = new_scene_nodes
            del nodes[root_idx]['children']
            print(f"Removed VRM_Character (node {root_idx}) from scene nodes, promoted {len(children)} children")
            # Also clear its transform since it stays in the array
            if 'rotation' in nodes[root_idx]: del nodes[root_idx]['rotation']
            if 'translation' in nodes[root_idx]: del nodes[root_idx]['translation']
            if 'scale' in nodes[root_idx]: del nodes[root_idx]['scale']

    # Record original node rest rotations before zeroing
    node_rest_rot = {}
    for i, n in enumerate(nodes):
        if i == root_idx: continue
        r = n.get('rotation')
        if r and r != [0,0,0,1]:
            node_rest_rot[i] = r

    # Discover ALL nodes that have translation animation channels (including Hips with identity rest)
    anim_translation_nodes = set()
    for anim in jd.get('animations', []):
        for ch in anim.get('channels', []):
            if ch.get('target', {}).get('path') == 'translation':
                anim_translation_nodes.add(ch['target']['node'])
    # Also record nodes with non-identity rest translation (for node definition cleanup)
    node_rest_trans = {}
    for i, n in enumerate(nodes):
        if i == root_idx: continue
        t = n.get('translation')
        if t and t != [0,0,0]:
            node_rest_trans[i] = t

    print(f"Nodes with non-identity rotation: {len(node_rest_rot)}")
    print(f"Nodes with non-zero translation:  {len(node_rest_trans)}")
    print(f"Nodes with translation animations: {len(anim_translation_nodes)}")
    for ni in sorted(anim_translation_nodes):
        print(f"  - {nodes[ni].get('name','?')} (node {ni})")

    # Adjust animation keyframes
    # Rotation: make relative to rest pose (conj(rest) * Q)
    # Translation: ZERO all keys (retargeter can't handle world-space translation in bone-local system)
    for anim in jd.get('animations', []):
        for ch in list(anim.get('channels', [])):
            target = ch.get('target', {})
            node = target.get('node')
            path = target.get('path')

            has_rot = node in node_rest_rot
            has_trans = node in anim_translation_nodes

            if not has_rot and not has_trans:
                continue

            sampler = anim['samplers'][ch.get('sampler', 0)]
            output = sampler.get('output', -1)
            acc = jd['accessors'][output]
            bv = jd['bufferViews'][acc.get('bufferView', 0)]
            off = bv.get('byteOffset', 0) + acc.get('byteOffset', 0)
            comp_sz = 4
            ncomp = {'VEC3': 3, 'VEC4': 4}.get(acc.get('type', 'VEC3'), 3)
            count = acc.get('count', 0)

            if path == 'rotation' and has_rot:
                inv_rest = qconj(node_rest_rot[node])
                for k in range(count):
                    o = off + k * comp_sz * ncomp
                    vals = rf(bd, o, 4)
                    adjusted = qnorm(qmult(inv_rest, vals))
                    wf(bd, o, adjusted)
                print(f"  Adjusted rotation keyframes for node {nodes[node].get('name','?')} ({node})")

            if path == 'translation' and has_trans:
                # Zero ALL translation keyframes — retargeter can't handle world-space deltas
                for k in range(count):
                    o = off + k * comp_sz * ncomp
                    wf(bd, o, [0, 0, 0])
                print(f"  Zeroed translation keyframes for node {nodes[node].get('name','?')} ({node})")

    # Zero out node rotations (remove from node definitions)
    for i in node_rest_rot:
        if 'rotation' in nodes[i]:
            del nodes[i]['rotation']
    # Zero out node translations with non-identity rest (Hips stays as-is)
    for i in node_rest_trans:
        if 'translation' in nodes[i]:
            del nodes[i]['translation']

    out_path = input_path if in_place else input_path.replace('.vrma', '_fixed.vrma')
    write_glb(out_path, jd, bytes(bd))
    print(f"Written: {out_path}")

if __name__ == '__main__':
    main()
