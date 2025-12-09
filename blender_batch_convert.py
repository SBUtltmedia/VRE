#!/usr/bin/env python3
"""
Blender Batch Conversion Script for CMU MoCap FBX Files
Converts FBX files with Spherical XYZ Euler order to standard formats

Usage:
    blender --background --python blender_batch_convert.py -- \
        --input-dir ./cmu_fbx/CMU_fbx \
        --output-dir ./converted_mocap \
        --format fbx

Formats:
    fbx   - Export as FBX with corrected Euler angles (XYZ order)
    gltf  - Export as glTF (animation clips)
    vrma  - Export as VRMA (requires VRM addon installed)
"""

import bpy
import os
import sys
import argparse
from pathlib import Path

def setup_scene():
    """Clear the default scene"""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()

    # Remove all armatures and meshes
    for obj in bpy.data.objects:
        bpy.data.objects.remove(obj, do_unlink=True)

def import_fbx(fbx_path):
    """Import FBX file with proper settings"""
    print(f"Importing: {fbx_path}")

    bpy.ops.import_scene.fbx(
        filepath=str(fbx_path),
        use_manual_orientation=True,
        global_scale=0.01,  # CMU MoCap is in centimeters
        bake_space_transform=True,  # Important: bake transforms
        use_anim=True,
        anim_offset=0.0,
        use_custom_props=True,
        use_custom_props_enum_as_string=True,
        ignore_leaf_bones=False,
        force_connect_children=False,
        automatic_bone_orientation=True,  # Let Blender fix bone orientations
        primary_bone_axis='Y',
        secondary_bone_axis='X',
        use_prepost_rot=True  # Handle pre/post rotations
    )

    print(f"✓ Imported successfully")

def export_fbx(output_path):
    """Export as FBX with corrected Euler angles"""
    print(f"Exporting FBX: {output_path}")

    bpy.ops.export_scene.fbx(
        filepath=str(output_path),
        use_selection=False,
        global_scale=1.0,
        apply_scale_options='FBX_SCALE_ALL',
        axis_forward='-Z',
        axis_up='Y',
        bake_space_transform=False,
        use_custom_props=True,
        path_mode='AUTO',
        embed_textures=False,
        batch_mode='OFF',
        use_batch_own_dir=False,
        # Animation settings
        bake_anim=True,
        bake_anim_use_all_bones=True,
        bake_anim_use_nla_strips=False,
        bake_anim_use_all_actions=False,
        bake_anim_force_startend_keying=True,
        bake_anim_step=1.0,
        bake_anim_simplify_factor=0.0,  # No simplification
        # Important: Use standard Euler XYZ
        use_metadata=True,
        add_leaf_bones=False,
        primary_bone_axis='Y',
        secondary_bone_axis='X'
    )

    print(f"✓ Exported FBX with standard Euler angles")

def export_gltf(output_path):
    """Export as glTF with animation"""
    print(f"Exporting glTF: {output_path}")

    # Ensure glTF exporter is available
    if not hasattr(bpy.ops, 'export_scene') or not hasattr(bpy.ops.export_scene, 'gltf'):
        print("ERROR: glTF exporter not available. Install it via Preferences > Add-ons")
        return False

    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format='GLTF_SEPARATE',  # .gltf + .bin
        export_animations=True,
        export_frame_range=True,
        export_nla_strips=False,
        export_apply=True,
        export_yup=True,
        export_skins=True,
        export_all_influences=False,
        export_morph=False,
        export_lights=False,
        export_cameras=False
    )

    print(f"✓ Exported glTF")
    return True

def export_vrma(output_path, vrm_path=None):
    """Export as VRMA (requires VRM addon)"""
    print(f"Exporting VRMA: {output_path}")

    # Check if VRM addon is installed
    if 'VRM_ADDON_for_Blender' not in bpy.context.preferences.addons:
        print("ERROR: VRM addon not installed. Install from https://github.com/vrm-c/VRM_Addon_for_Blender")
        return False

    # VRMA export requires a VRM model as reference
    # This would need additional implementation based on the VRM addon API
    print("VRMA export not yet implemented - requires VRM model reference")
    return False

def convert_file(input_path, output_dir, output_format='fbx'):
    """Convert a single FBX file"""
    input_path = Path(input_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Clear scene
    setup_scene()

    # Import FBX
    try:
        import_fbx(input_path)
    except Exception as e:
        print(f"ERROR importing {input_path}: {e}")
        return False

    # Determine output path
    stem = input_path.stem
    if output_format == 'fbx':
        output_path = output_dir / f"{stem}_converted.fbx"
        export_fbx(output_path)
    elif output_format == 'gltf':
        output_path = output_dir / f"{stem}.gltf"
        if not export_gltf(output_path):
            return False
    elif output_format == 'vrma':
        output_path = output_dir / f"{stem}.vrma"
        if not export_vrma(output_path):
            return False
    else:
        print(f"ERROR: Unknown format '{output_format}'")
        return False

    return True

def batch_convert(input_dir, output_dir, output_format='fbx', file_pattern='*.fbx'):
    """Convert all FBX files in a directory"""
    input_dir = Path(input_dir)
    output_dir = Path(output_dir)

    # Find all FBX files
    fbx_files = sorted(input_dir.glob(file_pattern))

    if not fbx_files:
        print(f"No files matching '{file_pattern}' found in {input_dir}")
        return

    print(f"\nFound {len(fbx_files)} files to convert")
    print(f"Input:  {input_dir}")
    print(f"Output: {output_dir}")
    print(f"Format: {output_format}\n")

    successful = 0
    failed = 0

    for i, fbx_file in enumerate(fbx_files, 1):
        print(f"\n[{i}/{len(fbx_files)}] Processing: {fbx_file.name}")
        print("-" * 60)

        try:
            if convert_file(fbx_file, output_dir, output_format):
                successful += 1
                print(f"✓ SUCCESS")
            else:
                failed += 1
                print(f"✗ FAILED")
        except Exception as e:
            failed += 1
            print(f"✗ FAILED with exception: {e}")
            import traceback
            traceback.print_exc()

    print("\n" + "=" * 60)
    print(f"Conversion complete!")
    print(f"  Successful: {successful}")
    print(f"  Failed:     {failed}")
    print(f"  Total:      {len(fbx_files)}")
    print("=" * 60)

def main():
    """Main entry point"""
    # Parse command line arguments (after the -- separator)
    argv = sys.argv

    # Find the -- separator
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = []

    parser = argparse.ArgumentParser(
        description='Batch convert CMU MoCap FBX files with corrected Euler angles'
    )
    parser.add_argument(
        '--input-dir',
        required=True,
        help='Input directory containing FBX files'
    )
    parser.add_argument(
        '--output-dir',
        required=True,
        help='Output directory for converted files'
    )
    parser.add_argument(
        '--format',
        choices=['fbx', 'gltf', 'vrma'],
        default='fbx',
        help='Output format (default: fbx)'
    )
    parser.add_argument(
        '--pattern',
        default='*.fbx',
        help='File pattern to match (default: *.fbx)'
    )
    parser.add_argument(
        '--single-file',
        help='Convert a single file instead of batch'
    )

    args = parser.parse_args(argv)

    if args.single_file:
        # Convert single file
        convert_file(args.single_file, args.output_dir, args.format)
    else:
        # Batch convert
        batch_convert(args.input_dir, args.output_dir, args.format, args.pattern)

if __name__ == "__main__":
    main()
