import bpy
import math
import sys
import os

def rotate_vrm(filepath, out_path):
    # Clear scene
    if bpy.context.active_object and bpy.context.active_object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()

    # Import
    print(f"Importing {filepath}...")
    try:
        bpy.ops.import_scene.vrm(filepath=filepath)
    except Exception as e:
        print(f"Error importing VRM: {e}")
        return

    # Find armature
    armature = None
    for obj in bpy.data.objects:
        if obj.type == 'ARMATURE':
            armature = obj
            break
    
    if not armature:
        print("No armature found")
        return

    print(f"Rotating armature {armature.name}...")
    # Rotate 180 degrees around Z
    armature.rotation_euler[2] += math.radians(180)
    
    # Select all and apply rotation to meshes and armature
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)

    # Export
    print(f"Exporting to {out_path}...")
    try:
        bpy.ops.export_scene.vrm(filepath=out_path)
        print(f"SUCCESS: Exported to {out_path}")
    except Exception as e:
        print(f"Error exporting VRM: {e}")

if __name__ == "__main__":
    # Expecting: blender -b -P rotate_vrm.py -- <input_vrm> <output_vrm>
    try:
        # Find the index of "--" which separates blender args from script args
        idx = sys.argv.index("--")
        input_vrm = sys.argv[idx + 1]
        output_vrm = sys.argv[idx + 2]
        
        # Resolve absolute paths because Blender might have a different CWD
        input_vrm = os.path.abspath(input_vrm)
        output_vrm = os.path.abspath(output_vrm)
        
        rotate_vrm(input_vrm, output_vrm)
    except (ValueError, IndexError) as e:
        print(f"Error parsing arguments: {e}")
        print("Usage: blender -b -P rotate_vrm.py -- <input_vrm> <output_vrm>")
