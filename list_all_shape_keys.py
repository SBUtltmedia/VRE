import bpy
import sys

filepath = "models/AIAN/AIAN_F_1_Casual_CLEANED.vrm"

try:
    bpy.ops.import_scene.vrm(filepath=filepath)
except Exception as e:
    print(f"Import Failed: {e}")
    sys.exit()

face = bpy.data.objects.get("H_DDS_HighRes")
if face and face.data.shape_keys:
    print(f"\n--- ALL SHAPE KEYS on {face.name} ---")
    for kb in face.data.shape_keys.key_blocks:
        print(f"  {kb.name}")
    print("------------------------------------------\n")
else:
    print("No face mesh or shape keys found")
