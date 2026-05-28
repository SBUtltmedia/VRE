"""
fbx_to_vrma.py  —  Blender add-on
Converts CMU Mocap FBX animations (gbionics/cmu-fbx) to VRMA format.

Run (background):
  blender --background --python fbx_to_vrma.py -- <fbx_path> <vrm_path> <output_dir>

Run (interactive):
  Install as add-on, then use the FBX→VRMA panel in View3D > N-Panel.
"""

bl_info = {
    "name": "FBX to VRMA Converter",
    "author": "Gemini CLI",
    "version": (1, 0),
    "blender": (3, 6, 0),
    "location": "View3D > N-Panel > FBX→VRMA",
    "description": "Convert CMU Mocap FBX animations to VRMA format for VRM characters",
    "category": "Animation",
}

import bpy
import os
import math
import sys
from pathlib import Path
from mathutils import Matrix, Quaternion

# ── Bone Mapping: CMU FBX → VRM (Mixamo naming) ──────────────────────────────

BONE_MAP = {
    'hip': 'Hips',
    'abdomen': 'Spine',
    'chest': 'Spine1',
    'neck': 'Neck',
    'head': 'Head',
    # Left arm
    'lCollar': 'LeftShoulder',
    'lShldr': 'LeftArm',
    'lForeArm': 'LeftForeArm',
    'lHand': 'LeftHand',
    # Right arm
    'rCollar': 'RightShoulder',
    'rShldr': 'RightArm',
    'rForeArm': 'RightForeArm',
    'rHand': 'RightHand',
    # Left leg
    'lButtock': 'LeftUpLeg',
    'lThigh': 'LeftLeg',
    'lShin': 'LeftFoot',
    'lFoot': 'LeftToeBase',
    # Right leg
    'rButtock': 'RightUpLeg',
    'rThigh': 'RightLeg',
    'rShin': 'RightFoot',
    'rFoot': 'RightToeBase',
    # Eyes
    'leftEye': 'LeftEye',
    'rightEye': 'RightEye',
    # Left fingers (CMU has 2 joints/finger; VRM has 4 — map what we can)
    'lThumb1': 'LeftHandThumb1',
    'lThumb2': 'LeftHandThumb2',
    'lIndex1': 'LeftHandIndex1',
    'lIndex2': 'LeftHandIndex2',
    'lMid1': 'LeftHandMiddle1',
    'lMid2': 'LeftHandMiddle2',
    'lRing1': 'LeftHandRing1',
    'lRing2': 'LeftHandRing2',
    'lPinky1': 'LeftHandPinky1',
    'lPinky2': 'LeftHandPinky2',
    # Right fingers
    'rThumb1': 'RightHandThumb1',
    'rThumb2': 'RightHandThumb2',
    'rIndex1': 'RightHandIndex1',
    'rIndex2': 'RightHandIndex2',
    'rMid1': 'RightHandMiddle1',
    'rMid2': 'RightHandMiddle2',
    'rRing1': 'RightHandRing1',
    'rRing2': 'RightHandRing2',
    'rPinky1': 'RightHandPinky1',
    'rPinky2': 'RightHandPinky2',
}

# VRM bones with no CMU counterpart — will stay at identity
UNMAPPED_VRM_BONES = [
    'Spine2',
    'HeadEnd', 'HeadEnd_end',
    'RightEye_end', 'LeftEye_end',
    'RightToeEnd', 'RightToeEnd_end',
    'LeftToeEnd', 'LeftToeEnd_end',
    'RightFingerBase', 'LeftFingerBase',
    'RightHandThumb3', 'RightHandThumb4', 'RightHandThumb4_end',
    'RightHandMiddle3', 'RightHandMiddle4', 'RightHandMiddle4_end',
    'RightHandRing3', 'RightHandRing4', 'RightHandRing4_end',
    'RightHandPinky3', 'RightHandPinky4', 'RightHandPinky4_end',
    'RightHandIndex3', 'RightHandIndex4', 'RightHandIndex4_end',
    'LeftHandThumb3', 'LeftHandThumb4', 'LeftHandThumb4_end',
    'LeftHandMiddle3', 'LeftHandMiddle4', 'LeftHandMiddle4_end',
    'LeftHandRing3', 'LeftHandRing4', 'LeftHandRing4_end',
    'LeftHandPinky3', 'LeftHandPinky4', 'LeftHandPinky4_end',
    'LeftHandIndex3', 'LeftHandIndex4', 'LeftHandIndex4_end',
]


# ── Utilities ─────────────────────────────────────────────────────────────────

def clear_scene():
    if bpy.context.active_object and bpy.context.active_object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for a in list(bpy.data.actions):   bpy.data.actions.remove(a)
    for m in list(bpy.data.meshes):    bpy.data.meshes.remove(m)
    for ar in list(bpy.data.armatures): bpy.data.armatures.remove(ar)


def get_armature():
    return next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)


def get_hips_bone_name(armature):
    try:
        return (armature.data.vrm_addon_extension.vrm1.humanoid
                .human_bones.hips.node.bone_name or "Hips")
    except Exception:
        return "Hips"


def bone_warning(fbx_name, vrm_name, msg=""):
    print(f"  ⚠ {fbx_name} → {vrm_name}: {msg}" if msg else f"  ⚠ {fbx_name} → {vrm_name}")


def get_action_fcurves(action):
    """Get fcurves from an action, handling Blender 5.0 layered actions."""
    if hasattr(action, 'fcurves') and len(list(action.fcurves)) > 0:
        return action.fcurves
    try:
        return action.layers[0].strips[0].channelbags[0].fcurves
    except (IndexError, AttributeError):
        return []


# ── Core Conversion ───────────────────────────────────────────────────────────

def convert_fbx_to_vrma(fbx_path, vrm_path, output_dir):
    """Main conversion logic. Returns the output VRMA path or None on failure."""
    fbx_name = Path(fbx_path).stem
    out_path = os.path.join(output_dir, f"{fbx_name}.vrma")

    # ── 1. Clear & import FBX ────────────────────────────────────────────────
    clear_scene()
    print(f"\n[1] Importing FBX: {os.path.basename(fbx_path)}")
    bpy.ops.import_scene.fbx(filepath=fbx_path)
    fbx_armature = get_armature()
    if not fbx_armature:
        print("ERROR: No armature in FBX")
        return None

    if not fbx_armature.animation_data or not fbx_armature.animation_data.action:
        print("ERROR: FBX has no animation")
        return None

    fbx_action = fbx_armature.animation_data.action
    fbx_action_name = fbx_action.name
    print(f"   Armature: {fbx_armature.name}  Bones: {len(fbx_armature.data.bones)}")
    print(f"   Action: '{fbx_action_name}'")

    # Get frame range and fcurves
    fcurves = list(get_action_fcurves(fbx_action))
    f_range = fbx_action.frame_range
    f_start = int(f_range[0])
    f_end = int(f_range[1])
    total_frames = f_end - f_start
    print(f"   Frame range: {f_start}–{f_end}  ({total_frames} frames)")
    print(f"   FCurves: {len(fcurves)}")

    # ── 2. Import VRM ────────────────────────────────────────────────────────
    print(f"\n[2] Importing VRM: {os.path.basename(vrm_path)}")
    bpy.ops.import_scene.vrm(filepath=vrm_path)
    vrm_armature = get_armature()
    if not vrm_armature:
        print("ERROR: No armature in VRM")
        return None

    # If both armatures exist, the second import added another — find the VRM one
    all_armatures = [o for o in bpy.data.objects if o.type == 'ARMATURE']
    if len(all_armatures) > 1:
        # The VRM armature is the one different from fbx_armature
        for a in all_armatures:
            if a.name != fbx_armature.name:
                vrm_armature = a
                break
        # Rename for clarity
        vrm_armature.name = "VRM_Character"
        fbx_armature.name = "FBX_Source"

    print(f"   Armature: {vrm_armature.name}  Bones: {len(vrm_armature.data.bones)}")

    # ── 3. Align armatures ────────────────────────────────────────────────────
    # Place VRM at FBX location so world-space transforms match
    vrm_armature.location = fbx_armature.location
    vrm_armature.rotation_euler = fbx_armature.rotation_euler

    # Build the reverse map for quick lookup
    vrm_to_fbx = {v: k for k, v in BONE_MAP.items()}

    # ── 4. Build action on VRM armature ──────────────────────────────────────
    bpy.context.view_layer.objects.active = vrm_armature
    bpy.ops.object.mode_set(mode='POSE')

    # Create a new action for the VRM armature
    if vrm_armature.animation_data:
        vrm_armature.animation_data.action = None
    else:
        vrm_armature.animation_data_create()

    vrm_action = bpy.data.actions.new(f"FBX_{fbx_name}")
    vrm_armature.animation_data.action = vrm_action

    # ── 5. Compute rest-pose correction per VRM bone ──────────────────────────
    # The VrmAnimationExporter evaluates bone.matrix (rest + animation) per frame
    # and extracts the local rotation relative to the parent's current pose.
    # If the VRM bone's rest pose has a non-identity rotation (from Y-up→Z-up),
    # the exported animation includes it. We pre-compensate by computing each
    # bone's local rest rotation and setting matrix_basis to cancel it out.
    print(f"\n[3] Computing rest-pose corrections for {len(BONE_MAP)} bone mappings...")

    bpy.context.view_layer.objects.active = vrm_armature
    bpy.ops.object.mode_set(mode='POSE')

    vrm_hips_name = get_hips_bone_name(vrm_armature)

    # At frame 0 (identity animation), compute each VRM bone's local rest rotation
    bpy.context.scene.frame_set(f_start)
    rest_corrections = {}
    for fbx_name, vrm_name in BONE_MAP.items():
        vrm_pb = vrm_armature.pose.bones.get(vrm_name)
        if not vrm_pb:
            continue
        # Local rest rotation = parent's inverse * bone's matrix
        parent = vrm_pb.parent
        parent_matrix = parent.matrix if parent else Matrix()
        local_rest = parent_matrix.inverted() @ vrm_pb.matrix
        local_rest_quat = local_rest.to_quaternion()
        # The correction that cancels this rest rotation
        rest_corrections[vrm_name] = local_rest_quat.inverted()

    # ── 6. Frame-by-frame bake with rest-pose correction ────────────────────
    # For each frame: vrm matrix_basis = correction @ fbx matrix_basis
    # This ensures the net local rotation at frame 0 is identity.
    print(f"   Baking {total_frames} frames...")

    for frame in range(f_start, f_end + 1):
        bpy.context.scene.frame_set(frame)

        for fbx_name, vrm_name in BONE_MAP.items():
            fbx_pb = fbx_armature.pose.bones.get(fbx_name)
            vrm_pb = vrm_armature.pose.bones.get(vrm_name)
            if not fbx_pb:
                bone_warning(fbx_name, vrm_name, "FBX bone not found")
                continue
            if not vrm_pb:
                bone_warning(fbx_name, vrm_name, "VRM bone not found")
                continue

            correction = rest_corrections.get(vrm_name)
            if correction:
                vrm_pb.rotation_quaternion = correction @ fbx_pb.rotation_quaternion
                vrm_pb.keyframe_insert('rotation_quaternion', frame=frame)
                if vrm_name == vrm_hips_name:
                    vrm_pb.location = fbx_pb.location
                    vrm_pb.keyframe_insert('location', frame=frame)

    # Set LINEAR interpolation
    vrm_action = vrm_armature.animation_data.action
    if vrm_action:
        fcurves = get_action_fcurves(vrm_action)
        if fcurves:
            for fc in fcurves:
                for kp in fc.keyframe_points:
                    kp.interpolation = 'LINEAR'

    # ── 6. Export VRMA ────────────────────────────────────────────────────────
    print(f"\n[4] Exporting VRMA: {os.path.basename(out_path)}")
    os.makedirs(output_dir, exist_ok=True)

    # Select VRM armature and its mesh children
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT')
    vrm_armature.select_set(True)
    for child in vrm_armature.children:
        if child.type == 'MESH':
            child.select_set(True)
    bpy.context.view_layer.objects.active = vrm_armature

    # Set scene frame range for export
    orig_fs = bpy.context.scene.frame_start
    orig_fe = bpy.context.scene.frame_end
    bpy.context.scene.frame_start = f_start
    bpy.context.scene.frame_end = f_end

    try:
        from bl_ext.blender_org.vrm.exporter.vrm_animation_exporter import VrmAnimationExporter
        VrmAnimationExporter.execute(bpy.context, Path(out_path), vrm_armature)
        result = out_path
        print(f"   ✓ Exported: {out_path}")
    except Exception as e:
        print(f"   ✗ Export failed: {e}")
        # Fallback: try operator-based export
        try:
            bpy.ops.vrm.export_vrma(filepath=out_path)
            result = out_path
            print(f"   ✓ Exported (operator): {out_path}")
        except Exception as e2:
            print(f"   ✗ Operator export also failed: {e2}")
            result = None

    # Restore
    bpy.context.scene.frame_start = orig_fs
    bpy.context.scene.frame_end = orig_fe

    return result


# ── Operator: Single File Conversion ──────────────────────────────────────────

class FBX2VRMA_OT_Convert(bpy.types.Operator):
    """Convert a single CMU FBX file to VRMA"""
    bl_idname = "fbx2vrma.convert"
    bl_label = "Convert FBX → VRMA"

    filepath: bpy.props.StringProperty(subtype='FILE_PATH')
    vrm_path: bpy.props.StringProperty(subtype='FILE_PATH')
    output_dir: bpy.props.StringProperty(subtype='DIR_PATH')

    def execute(self, context):
        if not os.path.exists(self.filepath):
            self.report({'ERROR'}, f"FBX not found: {self.filepath}")
            return {'CANCELLED'}
        if not os.path.exists(self.vrm_path):
            self.report({'ERROR'}, f"VRM not found: {self.vrm_path}")
            return {'CANCELLED'}

        result = convert_fbx_to_vrma(self.filepath, self.vrm_path, self.output_dir)
        if result:
            self.report({'INFO'}, f"VRMA written: {result}")
            return {'FINISHED'}
        else:
            self.report({'ERROR'}, "Conversion failed")
            return {'CANCELLED'}


# ── Operator: Batch Conversion ────────────────────────────────────────────────

class FBX2VRMA_OT_BatchConvert(bpy.types.Operator):
    """Convert all FBX files in a directory to VRMA"""
    bl_idname = "fbx2vrma.batch_convert"
    bl_label = "Batch Convert FBX Directory → VRMA"

    input_dir: bpy.props.StringProperty(subtype='DIR_PATH')
    vrm_path: bpy.props.StringProperty(subtype='FILE_PATH')
    output_dir: bpy.props.StringProperty(subtype='DIR_PATH')

    def execute(self, context):
        if not os.path.exists(self.input_dir):
            self.report({'ERROR'}, f"Input directory not found: {self.input_dir}")
            return {'CANCELLED'}
        if not os.path.exists(self.vrm_path):
            self.report({'ERROR'}, f"VRM not found: {self.vrm_path}")
            return {'CANCELLED'}

        fbx_files = sorted([
            os.path.join(self.input_dir, f)
            for f in os.listdir(self.input_dir)
            if f.lower().endswith('.fbx')
        ])
        if not fbx_files:
            self.report({'ERROR'}, f"No .fbx files in {self.input_dir}")
            return {'CANCELLED'}

        os.makedirs(self.output_dir, exist_ok=True)

        success_count = 0
        fail_count = 0
        for fbx_file in fbx_files:
            print(f"\n═══ Converting: {os.path.basename(fbx_file)} ═══")
            result = convert_fbx_to_vrma(fbx_file, self.vrm_path, self.output_dir)
            if result:
                success_count += 1
            else:
                fail_count += 1

        self.report({'INFO'}, f"Done: {success_count} OK, {fail_count} failed")
        return {'FINISHED'}


# ── UI Panel ──────────────────────────────────────────────────────────────────

class FBX2VRMA_PT_Panel(bpy.types.Panel):
    bl_label = "FBX → VRMA Converter"
    bl_idname = "FBX2VRMA_PT_Panel"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = 'FBX→VRMA'

    def draw(self, context):
        layout = self.layout
        props = context.scene.fbx2vrma
        col = layout.column(align=True)

        col.label(text="Target VRM Model:")
        col.prop(props, "vrm_path", text="")
        col.separator()

        col.label(text="Single Conversion:")
        row = col.row(align=True)
        row.prop(props, "fbx_path", text="FBX")
        row.operator("fbx2vrma.convert", text="Convert")

        col.separator()
        col.label(text="Batch Conversion:")
        col.prop(props, "batch_input_dir", text="Input Dir")
        col.prop(props, "batch_output_dir", text="Output Dir")
        col.operator("fbx2vrma.batch_convert", text="Batch Convert All")


# ── Property Group ────────────────────────────────────────────────────────────

class FBX2VRMA_Properties(bpy.types.PropertyGroup):
    fbx_path: bpy.props.StringProperty(
        name="FBX File",
        description="Path to the CMU Mocap FBX file",
        default="",
        subtype='FILE_PATH'
    )
    vrm_path: bpy.props.StringProperty(
        name="VRM Model",
        description="Path to the target VRM model (for skeleton)",
        default="",
        subtype='FILE_PATH'
    )
    batch_input_dir: bpy.props.StringProperty(
        name="Input Directory",
        description="Directory containing FBX files",
        default="",
        subtype='DIR_PATH'
    )
    batch_output_dir: bpy.props.StringProperty(
        name="Output Directory",
        description="Directory for output VRMA files",
        default="",
        subtype='DIR_PATH'
    )


# ── Registration ──────────────────────────────────────────────────────────────

classes = (
    FBX2VRMA_Properties,
    FBX2VRMA_OT_Convert,
    FBX2VRMA_OT_BatchConvert,
    FBX2VRMA_PT_Panel,
)

def register():
    for cls in classes:
        bpy.utils.register_class(cls)
    bpy.types.Scene.fbx2vrma = bpy.props.PointerProperty(type=FBX2VRMA_Properties)

def unregister():
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)
    del bpy.types.Scene.fbx2vrma


# ── CLI Entry Point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Parse CLI arguments after "--"
    try:
        idx = sys.argv.index("--")
        args = sys.argv[idx + 1:]
    except ValueError:
        args = []

    if len(args) >= 3:
        fbx_path = os.path.abspath(args[0])
        vrm_path = os.path.abspath(args[1])
        output_dir = os.path.abspath(args[2])
        register()
        result = convert_fbx_to_vrma(fbx_path, vrm_path, output_dir)
        if result:
            print(f"\nSUCCESS: {result}")
        else:
            print("\nFAILED")
            sys.exit(1)
    else:
        print("Usage:")
        print("  blender --background --python fbx_to_vrma.py -- <fbx> <vrm> <output_dir>")
        print("  Or install as add-on and use the UI panel.")
        register()
