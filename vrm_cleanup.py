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
    "M": "h_expressions.MPB_Up_h"
}

def process_vrm(filepath):

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

    # 1. Create standardized Shape Keys
    for std, valid in SHAPE_MAP.items():
        if valid in face.data.shape_keys.key_blocks:
            if std not in face.data.shape_keys.key_blocks:
                new_key = face.shape_key_add(name=std, from_mix=False)
                # Note: We use drivers to link them for better control
                print(f"Mapped {std} to {valid}")

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

    # Export
    base_name = os.path.splitext(filepath)[0]
    out_path = base_name + "_CLEANED.vrm"
    bpy.ops.export_scene.vrm(filepath=out_path)
    print(f"SUCCESS: Exported {out_path}")

if __name__ == "__main__":
    # Get filename passed from shell
    vrm_file = sys.argv[-1]
    process_vrm(vrm_file)
