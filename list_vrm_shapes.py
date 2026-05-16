import bpy
import sys
import os

def main():
    vrm_path = sys.argv[-1]
    if not vrm_path.endswith('.vrm'):
        return

    bpy.ops.wm.read_factory_settings(use_empty=True)

    # Try different ways to import
    success = False
    
    # Standard import_scene.vrm
    try:
        bpy.ops.import_scene.vrm(filepath=vrm_path)
        success = True
        print("Imported using bpy.ops.import_scene.vrm")
    except:
        pass

    # Addon specific operator seen in list
    if not success:
        try:
            bpy.ops.vrm.import_vrm_via_file_handler(filepath=vrm_path)
            success = True
            print("Imported using bpy.ops.vrm.import_vrm_via_file_handler")
        except:
            pass

    if not success:
        print("All import attempts failed.")
        return

    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            print(f"MESH: {obj.name}")
            if obj.data.shape_keys:
                print(f"  SHAPES: {[sk.name for sk in obj.data.shape_keys.key_blocks]}")

if __name__ == "__main__":
    main()
