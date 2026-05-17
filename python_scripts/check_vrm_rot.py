import bpy
import sys
import os

def check_rotation(filepath):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    bpy.ops.import_scene.vrm(filepath=filepath)
    
    for obj in bpy.data.objects:
        if obj.type == 'ARMATURE':
            print(f"DEBUG: Armature '{obj.name}' rotation: {obj.rotation_euler}")
            for child in obj.children:
                 print(f"DEBUG: Child '{child.name}' rotation: {child.rotation_euler}")

if __name__ == "__main__":
    idx = sys.argv.index("--")
    check_rotation(sys.argv[idx + 1])
