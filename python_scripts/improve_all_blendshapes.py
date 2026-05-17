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

def improve_single_blendshape(ref_path, target_path, shape_name, output_path):
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # Load Reference (MetaHuman)
    bpy.ops.import_scene.gltf(filepath=ref_path)
    ref_obj = find_main_mesh()
    if not ref_obj:
        print(f"Ref main mesh not found for {shape_name}")
        return False
    ref_obj.name = "REF_MAIN"

    # Load Target (VALID Avatar)
    bpy.ops.import_scene.gltf(filepath=target_path)
    target_obj = None
    for obj in bpy.data.objects:
        if obj.type == 'MESH' and obj.name != "REF_MAIN":
            if obj.data.shape_keys:
                 if not target_obj or len(obj.data.shape_keys.key_blocks) > len(target_obj.data.shape_keys.key_blocks):
                     target_obj = obj

    if not target_obj:
        print(f"Target main mesh not found for {shape_name}")
        return False
    target_obj.name = "TARGET_MAIN"

    print(f"Improving {shape_name} from {ref_obj.name} ({len(ref_obj.data.vertices)} verts) to {target_obj.name} ({len(target_obj.data.vertices)} verts)")

    # Check if shape exists in reference
    if shape_name not in ref_obj.data.shape_keys.key_blocks:
        print(f"Shape {shape_name} not found in Reference. Available: {[s.name for s in ref_obj.data.shape_keys.key_blocks]}")
        return False

    # Check if shape exists in target
    if shape_name not in target_obj.data.shape_keys.key_blocks:
        print(f"Shape {shape_name} not found in Target. Available: {[s.name for s in target_obj.data.shape_keys.key_blocks]}")
        return False

    ref_key = ref_obj.data.shape_keys.key_blocks[shape_name]
    target_key = target_obj.data.shape_keys.key_blocks[shape_name]

    # Transfer logic:
    ref_verts = [v.co for v in ref_key.data]
    kd = mathutils.kdtree.KDTree(len(ref_verts))
    for i, co in enumerate(ref_verts):
        kd.insert(co, i)
    kd.balance()

    improved_count = 0
    for i, v in enumerate(target_key.data):
        co, index, dist = kd.find(v.co)
        if dist < 0.1:
            v.co = co
            improved_count += 1

    print(f"Improved {improved_count}/{len(target_key.data)} vertices for {shape_name}")
    
    bpy.ops.export_scene.gltf(filepath=output_path, export_format='GLB')
    print(f"Saved improved model to {output_path}")
    return True

def main():
    # Create output directory
    os.makedirs("D:/VRE/improved_models", exist_ok=True)
    
    # Paths
    ref_path = "D:/VRE/models/MetaHuman/MetaHuman.vrm"
    target_path = "D:/VRE/models/Black/Black_M_1_Busi.vrm"
    
    # ARKit 52 blendshapes (most common ones)
    arkit_shapes = [
        'Basis',
        'eyeBlinkLeft', 'eyeBlinkRight', 'eyeLookDownLeft', 'eyeLookDownRight',
        'eyeLookInLeft', 'eyeLookInRight', 'eyeLookOutLeft', 'eyeLookOutRight',
        'eyeLookUpLeft', 'eyeLookUpRight', 'jawForward', 'jawLeft', 'jawRight',
        'jawOpen', 'mouthLeft', 'mouthRight', 'mouthSmileLeft', 'mouthSmileRight',
        'mouthFrownLeft', 'mouthFrownRight', 'mouthDimpleLeft', 'mouthDimpleRight',
        'mouthStretchLeft', 'mouthStretchRight', 'mouthUpperUpLeft', 'mouthUpperUpRight',
        'mouthLowerDownLeft', 'mouthLowerDownRight', 'mouthPressLeft', 'mouthPressRight',
        'mouthShrugUpper', 'mouthShrugLower', 'mouthRollLower', 'mouthRollUpper',
        'mouthFunnel', 'mouthPucker', 'mouthWide', 'mouthClose', 'mouthSmile',
        'mouthFrown', 'mouthDimple', 'mouthStretch', 'mouthUpperUp', 'mouthLowerDown',
        'mouthPress', 'mouthShrug', 'mouthRoll', 'mouthFunnel2', 'mouthPucker2',
        'mouthWide2'
    ]
    
    print(f"Starting improvement of {len(arkit_shapes)} ARKit blendshapes...")
    
    success_count = 0
    for shape_name in arkit_shapes:
        output_path = f"D:/VRE/improved_models/Black_M_1_Busi_{shape_name}_improved.glb"
        if improve_single_blendshape(ref_path, target_path, shape_name, output_path):
            success_count += 1
        
        # Clear scene for next iteration
        bpy.ops.wm.read_factory_settings(use_empty=True)
    
    print(f"\nCompleted! Successfully improved {success_count}/{len(arkit_shapes)} blendshapes")

if __name__ == "__main__":
    main()