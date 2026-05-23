import bpy
import os
import sys


def fix_wig_weights(filepath):
    # Reset Blender scene safely (don't disable VRM addon)
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

    # Find the wig mesh
    wig = bpy.data.objects.get("h_wig")
    if not wig:
        print("SKIP: No 'h_wig' mesh found in model")
        return

    print(f"Found 'h_wig' mesh ({len(wig.data.vertices)} vertices)")

    # Show current vertex groups
    print("Current vertex groups on h_wig:")
    for vg in wig.vertex_groups:
        print(f"  {vg.name}")

    # Remove RightEye weights from all vertices
    vg_eye = wig.vertex_groups.get("RightEye")
    if vg_eye:
        bpy.context.view_layer.objects.active = wig
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        wig.vertex_groups.remove(vg_eye)
        bpy.ops.object.mode_set(mode='OBJECT')
        print("Removed 'RightEye' vertex group from all vertices")

    # Find the Head bone name (try VRM humanoid mapping first)
    armature = None
    for obj in bpy.data.objects:
        if obj.type == 'ARMATURE':
            armature = obj
            break

    head_bone_name = "Head"
    if armature:
        # Check VRM humanoid bone mapping
        vrm0 = getattr(armature.data, "vrm_addon_extension", None)
        if vrm0 and vrm0.vrm0:
            for hb in vrm0.vrm0.humanoid.human_bones:
                if hb.bone == "head":
                    head_bone_name = hb.node.bone_name
                    print(f"VRM humanoid head bone: '{head_bone_name}'")
                    break

    # Assign all vertices to Head bone with full weight
    bpy.context.view_layer.objects.active = wig
    vg_head = wig.vertex_groups.get(head_bone_name)
    if not vg_head:
        vg_head = wig.vertex_groups.new(name=head_bone_name)
        print(f"Created new vertex group '{head_bone_name}'")

    vg_head.add([v.index for v in wig.data.vertices], 1.0, 'REPLACE')
    print(f"Assigned all vertices to '{head_bone_name}' with weight 1.0")

    # Export VRM
    base, ext = os.path.splitext(filepath)
    out_path = base + "_FIXED_WIG.vrm"
    bpy.ops.export_scene.vrm(filepath=out_path)
    print(f"SUCCESS: Exported {out_path}")


if __name__ == "__main__":
    vrm_file = sys.argv[-1]
    fix_wig_weights(vrm_file)
