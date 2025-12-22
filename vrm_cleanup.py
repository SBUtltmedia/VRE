import bpy
import os
import sys

# Mapping Google VALID shapes to Standard Phonemes
SHAPE_MAP = {
    "A": "h_expressions.AE_AA_h",
    "E": "h_expressions.Ax_E_h",
    "I": "h_expressions.TD_I_h",
    "O": "h_expressions.AO_a_h",
    "U": "h_expressions.UW_U_h",
    "F": "h_expressions.FV_h",
    "M": "h_expressions.MPB_Up_h",
    "S": "h_expressions.S_h",
    "CH": "h_expressions.SH_CH_h",
    "K": "h_expressions.KG_h",
    "N": "h_expressions.TD_I_h"
}

def process_vrm(filepath):
    # Reset Blender (Clear default objects safely)
    # We cannot use read_factory_settings as it disables the VRM addon
    if bpy.context.active_object and bpy.context.active_object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    
    # Import VRM
    try:
        bpy.ops.import_scene.vrm(filepath=filepath)
    except Exception as e:
        print(f"FAILED to import {filepath}: {e}")
        return

    face = bpy.data.objects.get("H_DDS_HighRes")
    teeth = bpy.data.objects.get("h_TeethDown")

    if not face:
        print(f"SKIP: No face mesh found in {filepath}")
        return

    # 1. Create standardized Shape Keys with copied vertex data
    for std, valid in SHAPE_MAP.items():
        if valid in face.data.shape_keys.key_blocks:
            if std not in face.data.shape_keys.key_blocks:
                # Get the source shape key
                source_key = face.data.shape_keys.key_blocks[valid]

                # Create new shape key
                new_key = face.shape_key_add(name=std, from_mix=False)

                # Copy vertex positions from source to new key
                for i, point in enumerate(source_key.data):
                    new_key.data[i].co = point.co

                print(f"Created '{std}' from '{valid}' with {len(source_key.data)} vertices copied")
            else:
                print(f"Shape key '{std}' already exists, skipping")

    # 2. Add Teeth Drivers
    if teeth and teeth.data.shape_keys:
        for std, valid_face_key in SHAPE_MAP.items():
            valid_teeth_key = valid_face_key.replace("h_expressions.", "h_teeth.t_")
            
            if valid_face_key in face.data.shape_keys.key_blocks and \
               valid_teeth_key in teeth.data.shape_keys.key_blocks:
                
                # Link Teeth key to Face key
                drv = teeth.data.shape_keys.key_blocks[valid_teeth_key].driver_add("value").driver
                var = drv.variables.new()
                var.name = "val"
                var.type = 'SINGLE_PROP'
                var.targets[0].id_type = 'KEY'
                var.targets[0].id = face.data.shape_keys
                var.targets[0].data_path = f'key_blocks["{valid_face_key}"].value'
                drv.expression = "val"

    # 3. Wire into VRM BlendShape Master (A, I, U, E, O)
    armature = None
    for obj in bpy.data.objects:
        if obj.type == 'ARMATURE':
            armature = obj
            break

    if armature and hasattr(armature.data, "vrm_addon_extension"):
        print("Wiring VRM BlendShapes...")
        vrm0 = armature.data.vrm_addon_extension.vrm0
        if vrm0:
            for group in vrm0.blend_shape_master.blend_shape_groups:
                # We only map the standard vowels that exist in our SHAPE_MAP
                if group.name in SHAPE_MAP:
                    target_key_name = group.name # "A", "E", etc.

                    # Check if this key actually exists on the face
                    if target_key_name in face.data.shape_keys.key_blocks:
                        print(f"  Wiring Preset {group.name} -> Shape Key '{target_key_name}' on mesh '{face.name}'")

                        # Clear existing binds for this preset to avoid conflicts
                        while group.binds:
                            group.binds.remove(0)

                        # Add new bind
                        bind = group.binds.add()
                        # Set mesh reference - try both methods for compatibility
                        bind.mesh.mesh_object_name = face.name
                        try:
                            # Some VRM addon versions need the data block set directly
                            bind.mesh.value = face.data
                        except:
                            pass
                        bind.index = target_key_name
                        bind.weight = 1.0

                        # Verify binding
                        print(f"    Bind created: mesh_object_name='{bind.mesh.mesh_object_name}', index='{bind.index}', weight={bind.weight}")


    # Export
    base_name = os.path.splitext(filepath)[0]
    out_path = base_name + "_CLEANED.vrm"
    bpy.ops.export_scene.vrm(filepath=out_path)
    print(f"SUCCESS: Exported {out_path}")

if __name__ == "__main__":
    # Get filename passed from shell
    vrm_file = sys.argv[-1]
    process_vrm(vrm_file)
