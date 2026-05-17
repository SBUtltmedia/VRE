import bpy
import sys

filepath = "models/AIAN/AIAN_F_1_Casual_CLEANED.vrm"

# Clear scene
# bpy.ops.wm.read_factory_settings(use_empty=True)

try:
    bpy.ops.import_scene.vrm(filepath=filepath)
except Exception as e:
    print(f"Import Failed: {e}")
    sys.exit()

face = bpy.data.objects.get("H_DDS_HighRes")
if face:
    print(f"\n--- ALL EXPRESSION KEYS on {face.name} ---")
    expressions = [kb.name for kb in face.data.shape_keys.key_blocks if "h_expressions" in kb.name]
    for exp in sorted(expressions):
        print(exp)
    print("------------------------------------------\n")
