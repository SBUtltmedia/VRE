import bpy
import os
import sys

# Mapping Google VALID shapes to Standard Phonemes (keep existing)
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

# Mapping existing h_expressions to ARKit names
ARKIT_ALIASES = {
    # Eyes
    "eyeBlinkLeft": "h_expressions.LeyeClose_h",
    "eyeBlinkRight": "h_expressions.ReyeClose_h",
    "eyeWideLeft": "h_expressions.LeyeOpen_h",
    "eyeWideRight": "h_expressions.ReyeOpen_h",
    "eyeSquintLeft": "h_expressions.Lsquint_h",
    "eyeSquintRight": "h_expressions.Rsquint_h",

    # Jaw
    "jawOpen": "h_expressions.MouthOpen_h",
    "jawForward": "h_expressions.JawFront_h",
    "jawLeft": "h_expressions.Ljaw_h",
    "jawRight": "h_expressions.Rjaw_h",

    # Mouth - Basic
    "mouthClose": "h_expressions.MPB_Down_h",
    "mouthPucker": "h_expressions.Kiss_h",

    # Mouth - Smile/Frown
    "mouthSmileLeft": "h_expressions.LsmileOpen_h",
    "mouthSmileRight": "h_expressions.RsmileOpen_h",
    "mouthFrownLeft": "h_expressions.LmouthSad_h",
    "mouthFrownRight": "h_expressions.RmouthSad_h",

    # Mouth - Dimple
    "mouthDimpleLeft": "h_expressions.LlipCorner_h",
    "mouthDimpleRight": "h_expressions.RlipCorner_h",

    # Mouth - Stretch
    "mouthStretchLeft": "h_expressions.LlipSide_h",
    "mouthStretchRight": "h_expressions.RlipSide_h",

    # Mouth - Upper/Lower
    "mouthUpperUpLeft": "h_expressions.LlipUp_h",
    "mouthUpperUpRight": "h_expressions.RlipUp_h",
    "mouthLowerDownLeft": "h_expressions.LlipDown_h",
    "mouthLowerDownRight": "h_expressions.RlipDown_h",

    # Mouth - Press
    "mouthPressLeft": "h_expressions.Lblow_h",
    "mouthPressRight": "h_expressions.Rblow_h",

    # Brows
    "browDownLeft": "h_expressions.LbrowDown_h",
    "browDownRight": "h_expressions.RbrowDown_h",
    "browOuterUpLeft": "h_expressions.LbrowUp_h",
    "browOuterUpRight": "h_expressions.RbrowUp_h",

    # Nose
    "noseSneerLeft": "h_expressions.Lnostril_h",
    "noseSneerRight": "h_expressions.Rnostril_h",

    # Cheek (using blow as approximation)
    "cheekPuff": "h_expressions.Lblow_h",  # Could average L+R
}

# Missing ARKit shapes to create (blended versions)
ARKIT_TO_CREATE = {
    # These blend deltas from existing shapes (fixed blending algorithm)
    "mouthLeft": ["h_expressions.LlipSide_h", "h_expressions.Ljaw_h"],
    "mouthRight": ["h_expressions.RlipSide_h", "h_expressions.Rjaw_h"],
    "browInnerUp": ["h_expressions.LbrowUp_h", "h_expressions.RbrowUp_h"],
    "mouthFunnel": ["h_expressions.Shout_h", "h_expressions.MouthOpen_h"],  # Funnel + jaw open
}

# Custom weights for blended shapes (if not specified, uses equal weights)
ARKIT_BLEND_WEIGHTS = {
    "mouthFunnel": [0.7, 0.3],  # 70% funnel shape, 30% jaw opening
}

def copy_shape_key(source_key, new_key):
    """Copy vertex data from source shape key to new shape key"""
    for i, point in enumerate(source_key.data):
        new_key.data[i].co = point.co

def create_blended_shape(face, name, source_names, weights=None):
    """Create a new shape by blending deltas from existing shapes"""
    if weights is None:
        weights = [1.0 / len(source_names)] * len(source_names)

    shape_keys = face.data.shape_keys.key_blocks

    # Get basis shape (rest position)
    basis = shape_keys['Basis']

    # Create new shape
    new_key = face.shape_key_add(name=name, from_mix=False)

    # Initialize new shape to basis position
    for i, point in enumerate(basis.data):
        new_key.data[i].co = point.co.copy()

    # Blend deltas from source shapes
    for source_name, weight in zip(source_names, weights):
        if source_name in shape_keys:
            source_key = shape_keys[source_name]
            for i in range(len(source_key.data)):
                # Calculate delta from basis
                delta_x = source_key.data[i].co.x - basis.data[i].co.x
                delta_y = source_key.data[i].co.y - basis.data[i].co.y
                delta_z = source_key.data[i].co.z - basis.data[i].co.z

                # Add weighted delta to new shape
                new_key.data[i].co.x += delta_x * weight
                new_key.data[i].co.y += delta_y * weight
                new_key.data[i].co.z += delta_z * weight

    print(f"Created blended shape '{name}' from {source_names}")
    return new_key

def process_vrm(filepath):
    # Reset Blender
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
    teeth_down = bpy.data.objects.get("h_TeethDown")
    teeth_up = bpy.data.objects.get("h_TeethUp")

    if not face:
        print(f"SKIP: No face mesh found in {filepath}")
        return

    print(f"\n{'='*60}")
    print(f"Processing: {os.path.basename(filepath)}")
    print(f"{'='*60}")

    # 1. Create standardized viseme shapes (existing functionality)
    print("\n[1/5] Creating standard visemes...")
    for std, valid in SHAPE_MAP.items():
        if valid in face.data.shape_keys.key_blocks:
            if std not in face.data.shape_keys.key_blocks:
                source_key = face.data.shape_keys.key_blocks[valid]
                new_key = face.shape_key_add(name=std, from_mix=False)
                copy_shape_key(source_key, new_key)
                print(f"  ✓ Created '{std}' from '{valid}'")
            else:
                print(f"  • Shape key '{std}' already exists")

    # 2. Create ARKit aliases (NEW!)
    print("\n[2/5] Creating ARKit aliases...")
    alias_count = 0
    for arkit_name, h_expr_name in ARKIT_ALIASES.items():
        if h_expr_name in face.data.shape_keys.key_blocks:
            if arkit_name not in face.data.shape_keys.key_blocks:
                source_key = face.data.shape_keys.key_blocks[h_expr_name]
                new_key = face.shape_key_add(name=arkit_name, from_mix=False)
                copy_shape_key(source_key, new_key)
                alias_count += 1
            else:
                print(f"  • ARKit shape '{arkit_name}' already exists")

    print(f"  ✓ Created {alias_count} ARKit aliases")

    # 3. Create missing ARKit shapes by blending (NEW!)
    print("\n[3/5] Creating missing ARKit shapes...")
    created_count = 0
    for arkit_name, source_list in ARKIT_TO_CREATE.items():
        if arkit_name not in face.data.shape_keys.key_blocks:
            # Use custom weights if specified, otherwise use equal weights
            weights = ARKIT_BLEND_WEIGHTS.get(arkit_name, None)
            create_blended_shape(face, arkit_name, source_list, weights)
            created_count += 1

    print(f"  ✓ Created {created_count} blended ARKit shapes")

    # 4. Setup Teeth Drivers (ENHANCED!)
    print("\n[4/5] Setting up teeth drivers...")
    teeth_driver_count = 0

    for teeth, teeth_prefix in [(teeth_down, "h_teeth.t_"), (teeth_up, "h_teeth.t_")]:
        if not teeth or not teeth.data.shape_keys:
            continue

        # Link teeth to our viseme shapes (A, I, U, etc.)
        for std_name in SHAPE_MAP.keys():
            # Find corresponding teeth shape
            valid_face_key = SHAPE_MAP[std_name]
            valid_teeth_key = valid_face_key.replace("h_expressions.", teeth_prefix)

            if std_name in face.data.shape_keys.key_blocks and \
               valid_teeth_key in teeth.data.shape_keys.key_blocks:

                # Clear existing driver
                teeth_key = teeth.data.shape_keys.key_blocks[valid_teeth_key]
                teeth_key.driver_remove("value")

                # Create driver linking teeth to our viseme
                drv = teeth_key.driver_add("value").driver
                var = drv.variables.new()
                var.name = "val"
                var.type = 'SINGLE_PROP'
                var.targets[0].id_type = 'KEY'
                var.targets[0].id = face.data.shape_keys
                var.targets[0].data_path = f'key_blocks["{std_name}"].value'
                drv.expression = "val"
                teeth_driver_count += 1

    print(f"  ✓ Created {teeth_driver_count} teeth drivers")

    # 5. Wire into VRM BlendShape Master (existing functionality)
    print("\n[5/5] Wiring VRM BlendShape presets...")
    armature = None
    for obj in bpy.data.objects:
        if obj.type == 'ARMATURE':
            armature = obj
            break

    if armature and hasattr(armature.data, "vrm_addon_extension"):
        vrm0 = armature.data.vrm_addon_extension.vrm0
        if vrm0:
            preset_count = 0
            for group in vrm0.blend_shape_master.blend_shape_groups:
                if group.name in SHAPE_MAP:
                    target_key_name = group.name

                    if target_key_name in face.data.shape_keys.key_blocks:
                        # Clear existing binds
                        while group.binds:
                            group.binds.remove(0)

                        # Add new bind
                        bind = group.binds.add()
                        bind.mesh.mesh_object_name = face.name
                        try:
                            bind.mesh.value = face.data
                        except:
                            pass
                        bind.index = target_key_name
                        bind.weight = 1.0
                        preset_count += 1

            print(f"  ✓ Wired {preset_count} VRM presets")

    # Summary
    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    total_shapes = len(face.data.shape_keys.key_blocks)
    print(f"Total blend shapes in model: {total_shapes}")
    print(f"  - Standard visemes (A-N): {len(SHAPE_MAP)}")
    print(f"  - ARKit aliases: {alias_count}")
    print(f"  - ARKit created: {created_count}")
    print(f"  - ARKit total: ~{alias_count + created_count} of 52")
    print(f"  - Teeth drivers: {teeth_driver_count}")

    # Export
    base_name = os.path.splitext(filepath)[0]
    out_path = base_name + "_CLEANED.vrm"
    bpy.ops.export_scene.vrm(filepath=out_path)
    print(f"\n✓ SUCCESS: Exported {out_path}")
    print(f"{'='*60}\n")

if __name__ == "__main__":
    vrm_file = sys.argv[-1]
    process_vrm(vrm_file)
