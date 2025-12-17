import bpy
import os

print("\n--- CHECKING IMPORT AFTER RESET ---")

target_file = "models/avatar.vrm"
if not os.path.exists(target_file):
    print(f"Test file {target_file} not found!")
else:
    print(f"Test file found: {target_file}")
    
    print("Resetting factory settings...")
    bpy.ops.wm.read_factory_settings(use_empty=True)

    try:
        print("Attempting import...")
        bpy.ops.import_scene.vrm(filepath=target_file)
        print("Import SUCCESS")
    except Exception as e:
        print(f"Import FAILED: {e}")

print("-----------------------------------\n")


