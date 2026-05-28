"""Inspect Hips animation in VRMA files"""
import struct, json, sys

GLB_MAGIC = b'glTF'
for fname in sys.argv[1:]:
    print(f'=== {fname} ===')
    with open(fname, 'rb') as f:
        if f.read(4) != GLB_MAGIC: 
            print('  Not a GLB')
            continue
        f.read(8)
        jd = None
        bd = None
        while True:
            h = f.read(8)
            if len(h) < 8: break
            cl, ct = struct.unpack('<II', h)
            d = f.read(cl)
            if ct == 0x4E4F534A:
                jd = json.loads(d.decode('utf-8'))
            elif ct == 0x004E4942:
                bd = d

    if jd is None:
        print('  No JSON chunk')
        continue

    nodes = jd.get('nodes', [])
    for i, n in enumerate(nodes[:8]):
        r = n.get('rotation', '-')
        t = n.get('translation', '-')
        print(f'  Node {i}: name={n.get("name","?")} rot={r} trans={t}')
    
    # Find Hips node index
    hips_idx = None
    for i, n in enumerate(nodes):
        if n.get('name') == 'Hips':
            hips_idx = i
            break
    
    if hips_idx is None:
        # Try node 0
        hips_idx = 0
    
    for anim in jd.get('animations', []):
        print(f'  Samplers: {len(anim.get("samplers",[]))}, Channels: {len(anim.get("channels",[]))}')
        for ch in anim.get('channels', []):
            tgt = ch.get('target', {})
            if tgt.get('node') != hips_idx or tgt.get('path') != 'translation':
                continue
            sampler = anim['samplers'][ch.get('sampler', 0)]
            output = sampler.get('output', -1)
            input_s = sampler.get('input', -1)
            inp_acc = jd['accessors'][input_s]
            acc = jd['accessors'][output]
            bv = jd['bufferViews'][acc.get('bufferView', 0)]
            off = bv.get('byteOffset', 0) + acc.get('byteOffset', 0)
            inp_bv = jd['bufferViews'][inp_acc.get('bufferView', 0)]
            inp_off = inp_bv.get('byteOffset', 0) + inp_acc.get('byteOffset', 0)
            cnt = acc.get('count', 0)
            print(f'  Hips trans accessor: count={cnt}, compType={acc.get("componentType")}')
            for k in range(min(3, cnt)):
                inp_v = list(struct.unpack_from('<f', bd, inp_off + k*4))[0]
                vals = list(struct.unpack_from('<3f', bd, off + k*12))
                print(f'    frame {k}: time={inp_v:.3f} pos=({vals[0]:.4f}, {vals[1]:.4f}, {vals[2]:.4f})')
            if cnt > 3:
                k = cnt - 1
                inp_v = list(struct.unpack_from('<f', bd, inp_off + k*4))[0]
                vals = list(struct.unpack_from('<3f', bd, off + k*12))
                print(f'    frame {k}: time={inp_v:.3f} pos=({vals[0]:.4f}, {vals[1]:.4f}, {vals[2]:.4f})')
