import bpy

print("\n--- INSPECTING BIND PROP ---")
# Create dummy armature to access types if possible, or just import one
# bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.vrm(filepath="models/AIAN/AIAN_F_1_Casual.vrm")

armature = [obj for obj in bpy.data.objects if obj.type == 'ARMATURE'][0]
vrm0 = armature.data.vrm_addon_extension.vrm0
group = vrm0.blend_shape_master.blend_shape_groups.add()
bind = group.binds.add()

print(f"Bind type: {type(bind)}")
print(f"Bind dir: {dir(bind)}")

print(f"bind.mesh value: {bind.mesh}")
print(f"bind.mesh dir: {dir(bind.mesh)}")
# try setting
try:
    bind.mesh = bpy.data.objects["H_DDS_HighRes"]
    print("Set mesh object: SUCCESS")
except Exception as e:
    print(f"Set mesh object: FAILED ({e})")

try:
    bind.mesh.name = "H_DDS_HighRes"
    print("Set mesh.name: SUCCESS")
except Exception as e:
    print(f"Set mesh.name: FAILED ({e})")
    
print("----------------------------\n")

