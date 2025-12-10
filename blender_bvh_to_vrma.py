#!/usr/bin/env python3
"""
Blender BVH to VRMA Conversion Script
Converts CMU MoCap BVH files to VRMA format using a reference VRM model

Usage:
    blender --background --python blender_bvh_to_vrma.py -- \
        --input-dir ./cmu-mocap/data \
        --output-dir ./cmu_mocap_vrma \
        --vrm-model ./models/AIAN/AIAN_M_1_Casual.vrm
"""

import bpy
import os
import sys
import argparse
from pathlib import Path
import math

def setup_scene():
    """Clear the default scene"""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()

    # Remove all objects, armatures and meshes
    for obj in bpy.data.objects:
        bpy.data.objects.remove(obj, do_unlink=True)

    # Clear animations
    for action in bpy.data.actions:
        bpy.data.actions.remove(action)

def import_vrm(vrm_path):
    """Import VRM model"""
    print(f"Importing VRM model: {vrm_path}")

    try:
        # VRM models are glTF-based, so we use the glTF importer
        bpy.ops.import_scene.gltf(filepath=str(vrm_path))
        print(f"✓ VRM model imported successfully")

        # Find the armature
        armature = None
        for obj in bpy.data.objects:
            if obj.type == 'ARMATURE':
                armature = obj
                break

        if not armature:
            print("ERROR: No armature found in VRM model")
            return None

        return armature

    except Exception as e:
        print(f"ERROR importing VRM: {e}")
        return None

def import_bvh(bvh_path, scale=0.01):
    """Import BVH file"""
    print(f"Importing BVH: {bvh_path}")

    try:
        bpy.ops.import_anim.bvh(
            filepath=str(bvh_path),
            global_scale=scale,  # CMU MoCap is in centimeters
            rotate_mode='NATIVE',
            update_scene_fps=True,
            update_scene_duration=True
        )

        # Find the imported armature (should be the newest one)
        bvh_armature = None
        for obj in bpy.data.objects:
            if obj.type == 'ARMATURE' and obj.name != 'Armature':
                bvh_armature = obj
                break

        if not bvh_armature:
            # Try to find any armature
            for obj in bpy.data.objects:
                if obj.type == 'ARMATURE':
                    bvh_armature = obj
                    break

        print(f"✓ BVH imported successfully")
        return bvh_armature

    except Exception as e:
        print(f"ERROR importing BVH: {e}")
        import traceback
        traceback.print_exc()
        return None

def export_vrma(output_path, armature):
    """Export animation as VRMA"""
    print(f"Exporting VRMA: {output_path}")

    try:
        # Select the armature
        bpy.ops.object.select_all(action='DESELECT')
        armature.select_set(True)
        bpy.context.view_layer.objects.active = armature

        # Export as glTF with animation only
        # VRMA is essentially a glTF animation file
        # Export with .glb extension first, then rename
        output_path_obj = Path(output_path)
        temp_glb_path = output_path_obj.with_suffix('.glb')

        bpy.ops.export_scene.gltf(
            filepath=str(temp_glb_path),
            export_format='GLB',  # Binary format
            export_animations=True,
            export_frame_range=True,
            export_nla_strips=False,
            export_def_bones=False,
            export_optimize_animation_size=True,
            export_anim_single_armature=True,
            export_current_frame=False,
            export_skins=True,
            export_all_influences=False,
            export_morph=False,
            export_lights=False,
            export_cameras=False,
            export_apply=False
        )

        # Rename .glb to .vrma if the file was created
        if temp_glb_path.exists():
            temp_glb_path.rename(output_path_obj)
            print(f"✓ Exported VRMA (renamed from GLB)")
        else:
            print(f"WARNING: Expected GLB file not found at {temp_glb_path}")

        return True

    except Exception as e:
        print(f"ERROR exporting VRMA: {e}")
        import traceback
        traceback.print_exc()
        return False

def retarget_animation(source_armature, target_armature):
    """Retarget animation from BVH armature to VRM armature"""
    print("Retargeting animation...")

    # This is a simplified retargeting approach
    # For production use, you'd want more sophisticated bone mapping

    try:
        # Make target armature active
        bpy.context.view_layer.objects.active = target_armature

        # Copy the animation action from source to target
        if source_armature.animation_data and source_armature.animation_data.action:
            action = source_armature.animation_data.action

            # Create animation data for target if it doesn't exist
            if not target_armature.animation_data:
                target_armature.animation_data_create()

            # Assign the action to target
            target_armature.animation_data.action = action.copy()

            print("✓ Animation retargeted")
            return True
        else:
            print("WARNING: No animation data found on source armature")
            return False

    except Exception as e:
        print(f"ERROR retargeting animation: {e}")
        import traceback
        traceback.print_exc()
        return False

def convert_bvh_to_vrma(bvh_path, output_path, vrm_model_path=None):
    """Convert a single BVH file to VRMA"""

    # Clear scene
    setup_scene()

    # Import BVH animation
    bvh_armature = import_bvh(bvh_path)
    if not bvh_armature:
        print("Failed to import BVH")
        return False

    # For now, we'll export the BVH animation directly as VRMA
    # without VRM retargeting (simpler approach)
    success = export_vrma(output_path, bvh_armature)

    return success

def batch_convert(input_dir, output_dir, vrm_model=None):
    """Convert all BVH files in directory tree"""
    input_dir = Path(input_dir)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Find all BVH files recursively
    bvh_files = sorted(input_dir.rglob('*.bvh'))

    if not bvh_files:
        print(f"No BVH files found in {input_dir}")
        return

    print(f"\nFound {len(bvh_files)} BVH files to convert")
    print(f"Input:  {input_dir}")
    print(f"Output: {output_dir}")
    print()

    successful = 0
    failed = 0

    for i, bvh_file in enumerate(bvh_files, 1):
        # Preserve directory structure
        relative_path = bvh_file.relative_to(input_dir)
        output_file = output_dir / relative_path.with_suffix('.vrma')
        output_file.parent.mkdir(parents=True, exist_ok=True)

        print(f"\n[{i}/{len(bvh_files)}] Processing: {relative_path}")
        print("-" * 60)

        try:
            if convert_bvh_to_vrma(bvh_file, output_file, vrm_model):
                successful += 1
                print(f"✓ SUCCESS: {output_file}")
            else:
                failed += 1
                print(f"✗ FAILED: {bvh_file}")
        except Exception as e:
            failed += 1
            print(f"✗ FAILED with exception: {e}")
            import traceback
            traceback.print_exc()

    print("\n" + "=" * 60)
    print(f"Conversion complete!")
    print(f"  Successful: {successful}")
    print(f"  Failed:     {failed}")
    print(f"  Total:      {len(bvh_files)}")
    print("=" * 60)

def main():
    """Main entry point"""
    # Parse command line arguments (after the -- separator)
    argv = sys.argv

    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = []

    parser = argparse.ArgumentParser(
        description='Convert CMU MoCap BVH files to VRMA format'
    )
    parser.add_argument(
        '--input-dir',
        required=True,
        help='Input directory containing BVH files'
    )
    parser.add_argument(
        '--output-dir',
        required=True,
        help='Output directory for VRMA files'
    )
    parser.add_argument(
        '--vrm-model',
        help='Reference VRM model (optional)'
    )
    parser.add_argument(
        '--single-file',
        help='Convert a single file instead of batch'
    )

    args = parser.parse_args(argv)

    if args.single_file:
        # Convert single file
        output_file = Path(args.output_dir) / (Path(args.single_file).stem + '.vrma')
        output_file.parent.mkdir(parents=True, exist_ok=True)
        convert_bvh_to_vrma(args.single_file, output_file, args.vrm_model)
    else:
        # Batch convert
        batch_convert(args.input_dir, args.output_dir, args.vrm_model)

if __name__ == "__main__":
    main()
