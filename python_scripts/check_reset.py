import bpy

print("\n--- CHECKING RESET BEHAVIOR ---")

if hasattr(bpy.ops.import_scene, "vrm"):
    print("Before reset: bpy.ops.import_scene.vrm EXISTS")
else:
    print("Before reset: bpy.ops.import_scene.vrm MISSING")

print("Resetting factory settings...")
bpy.ops.wm.read_factory_settings(use_empty=True)

if hasattr(bpy.ops.import_scene, "vrm"):
    print("After reset: bpy.ops.import_scene.vrm EXISTS")
else:
    print("After reset: bpy.ops.import_scene.vrm MISSING")

print("-------------------------------\n")
