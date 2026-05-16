import bpy
import sys
import os
import mathutils

def find_main_mesh():
    best_obj = None
    max_keys = -1
    for obj in bpy.data.objects:
        if obj.type == 'MESH' and obj.data.shape_keys:
            num_keys = len(obj.data.shape_keys.key_blocks)
            if num_keys > max_keys:
                max_keys = num_keys
                best_obj = obj
    return best_obj

def main():
    args = sys.argv[sys.argv.index("--") + 1:]
    ref_path = args[0]
    target_path = args[1]
    shape_name = args[2]
    output_path = args[3]

    bpy.ops.wm.read_factory_settings(use_empty=True)

    # Load Reference
    bpy.ops.import_scene.gltf(filepath=ref_path)
    ref_obj = find_main_mesh()
    if not ref_obj:
        print("Ref main mesh not found")
        return
    ref_obj.name = "REF_MAIN"

    # Load Target
    bpy.ops.import_scene.gltf(filepath=target_path)
    target_obj = None
    for obj in bpy.data.objects:
        if obj.type == 'MESH' and obj.name != "REF_MAIN":
            # Heuristic: the mesh with the most shape keys is usually the head/face
            if obj.data.shape_keys:
                 if not target_obj or len(obj.data.shape_keys.key_blocks) > len(target_obj.data.shape_keys.key_blocks):
                     target_obj = obj
    
    if not target_obj:
        print("Target main mesh not found")
        return
    target_obj.name = "TARGET_MAIN"

    print(f"Aligning {shape_name} from {ref_obj.name} ({len(ref_obj.data.vertices)} verts) to {target_obj.name} ({len(target_obj.data.vertices)} verts)")

    if shape_name not in ref_obj.data.shape_keys.key_blocks:
        print(f"Shape {shape_name} not found in Reference. Available: {[s.name for s in ref_obj.data.shape_keys.key_blocks]}")
        return
    
    if shape_name not in target_obj.data.shape_keys.key_blocks:
        print(f"Shape {shape_name} not found in Target. Available: {[s.name for s in target_obj.data.shape_keys.key_blocks]}")
        return

    ref_key = ref_obj.data.shape_keys.key_blocks[shape_name]
    target_key = target_obj.data.shape_keys.key_blocks[shape_name]

    # Transfer logic:
    # 1. Set ref_key to 1.0
    # 2. Find closest points
    ref_verts = [v.co for v in ref_key.data]
    kd = mathutils.kdtree.KDTree(len(ref_verts))
    for i, co in enumerate(ref_verts):
        kd.insert(co, i)
    kd.balance()

    for i, v in enumerate(target_key.data):
        co, index, dist = kd.find(v.co)
        if dist < 0.1: # Increased threshold
            v.co = co

    bpy.ops.export_scene.gltf(filepath=output_path, export_format='GLB')
    print(f"Saved improved model to {output_path}")

if __name__ == "__main__":
    main()
