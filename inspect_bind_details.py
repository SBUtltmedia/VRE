import bpy
import sys

filepath = "models/AIAN/AIAN_F_1_Casual_CLEANED.vrm"

print(f"\n--- DETAILED BIND INSPECTION: {filepath} ---")

try:
    bpy.ops.import_scene.vrm(filepath=filepath)
except Exception as e:
    print(f"Import Failed: {e}")
    sys.exit()

armature = None
for obj in bpy.data.objects:
    if obj.type == 'ARMATURE':
        armature = obj
        break

if not armature:
    print("No Armature found.")
    sys.exit()

if hasattr(armature.data, "vrm_addon_extension"):
    vrm_ext = armature.data.vrm_addon_extension
    if hasattr(vrm_ext, "vrm0"):
        bs_groups = vrm_ext.vrm0.blend_shape_master.blend_shape_groups

        targets = ["A", "I", "U", "E", "O"]

        for group in bs_groups:
            if group.name in targets:
                print(f"\nGroup '{group.name}':")
                print(f"  Number of binds: {len(group.binds)}")
                for i, bind in enumerate(group.binds):
                    print(f"  Bind {i}:")
                    print(f"    mesh_object_name: '{bind.mesh.mesh_object_name}'")
                    print(f"    index: '{bind.index}'")
                    print(f"    weight: {bind.weight}")
                    # Try to get the actual mesh
                    if bind.mesh.mesh_object_name:
                        mesh_obj = bpy.data.objects.get(bind.mesh.mesh_object_name)
                        if mesh_obj:
                            print(f"    ✓ Mesh object found: {mesh_obj.name}")
                            if mesh_obj.data.shape_keys:
                                if bind.index in mesh_obj.data.shape_keys.key_blocks:
                                    print(f"    ✓ Shape key '{bind.index}' exists")
                                else:
                                    print(f"    ✗ Shape key '{bind.index}' NOT found")
                        else:
                            print(f"    ✗ Mesh object NOT found")

print("\n----------------------------------------------\n")
