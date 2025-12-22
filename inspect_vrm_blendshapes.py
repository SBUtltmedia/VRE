import bpy
import sys

filepath = "models/AIAN/AIAN_F_1_Casual_CLEANED.vrm"

print(f"\n--- INSPECTING VRM BLENDSHAPES: {filepath} ---")

# Clear scene
# bpy.ops.wm.read_factory_settings(use_empty=True)

try:
    bpy.ops.import_scene.vrm(filepath=filepath)
except Exception as e:
    print(f"Import Failed: {e}")
    sys.exit()

# Access VRM extension data
# The location differs slightly between VRM addon versions, but usually it's on the Armature
armature = None
for obj in bpy.data.objects:
    if obj.type == 'ARMATURE':
        armature = obj
        break

if not armature:
    print("No Armature found.")
    sys.exit()

print(f"Armature found: {armature.name}")

# Try to access blend shape groups
# VRM 0.x style
if hasattr(armature.data, "vrm_addon_extension"):
    vrm_ext = armature.data.vrm_addon_extension
    if hasattr(vrm_ext, "vrm0"):
        bs_groups = vrm_ext.vrm0.blend_shape_master.blend_shape_groups
        
        print(f"Found {len(bs_groups)} BlendShape Groups.")
        
        targets = ["A", "I", "U", "E", "O", "Fun", "Joy", "Sorrow", "Angry"]
        
        for group in bs_groups:
            if group.name in targets:
                print(f"Group '{group.name}':")
                for bind in group.binds:
                    mesh_name = bind.mesh.name if bind.mesh else "None"
                    print(f"  - Mesh: {mesh_name}, Key: {bind.index}")
    else:
        print("VRM 0.x extension not found or structure differs.")
else:
    print("vrm_addon_extension not found on armature data.")

print("----------------------------------------------\n")
