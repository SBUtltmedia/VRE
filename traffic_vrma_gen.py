"""
traffic_vrma_gen.py  —  Blender 5.0 background script
Generates 36 VRMA files (12 segments × ROOT / BODY / FACE) from vrma/15_05.vrma.

Run:
  blender --background --python traffic_vrma_gen.py
"""

import bpy
import json
import os
from pathlib import Path

from bl_ext.blender_org.vrm.importer.vrm_animation_importer import VrmAnimationImporter
from bl_ext.blender_org.vrm.exporter.vrm_animation_exporter import VrmAnimationExporter

# ── CONFIG ────────────────────────────────────────────────────────────────────
BASE    = r"c:\Users\pauls\VRE"
VRM_IN  = os.path.join(BASE, "models", "Black", "Black_M_1_Casual.vrm")
VRMA_IN = os.path.join(BASE, "vrma", "15_05.vrma")
OUT_DIR = os.path.join(BASE, "vrma", "traffic")
LS_DIR  = os.path.join(BASE, "qwenTTS", "lipsync")
FPS     = 30

AUDIO_DURATIONS = [3.92, 3.04, 5.36, 7.36, 8.24, 6.32, 5.76,
                   3.92, 6.08, 5.20, 9.92, 5.04]

PHON_W = {
    'X': 0.0, 'B': 0.0,
    'F': 0.25, 'H': 0.35, 'E': 0.45,
    'C': 0.50, 'D': 0.65, 'G': 0.70,
    'A': 0.85,
}

# ── HELPERS ───────────────────────────────────────────────────────────────────

def get_hips_bone_name(armature):
    try:
        return (armature.data.vrm_addon_extension.vrm1.humanoid
                .human_bones.hips.node.bone_name or "Hips")
    except Exception:
        return "Hips"


def get_channelbag(action):
    """Return the first channelbag from a Blender 5.0 layered action."""
    return action.layers[0].strips[0].channelbags[0]


def copy_filtered_action(src_act, mode, hips_bone_name):
    """
    Deep-copy src_act and remove fcurves that don't belong to the requested layer.
    ROOT  — Hips location only
    BODY  — all bone rotations except Hips location (no facial)
    Returns None if the filtered action has no fcurves.
    """
    new_act = src_act.copy()
    new_act.name = f"_tmp_{mode}"
    cb = get_channelbag(new_act)

    to_remove = []
    for fc in cb.fcurves:
        path = fc.data_path
        is_hips_loc = (f'pose.bones["{hips_bone_name}"]' in path
                       and "location" in path)
        is_bone    = path.startswith('pose.bones')
        is_facial  = ("key_blocks" in path
                      or ("vrm" in path.lower() and
                          ("weight" in path.lower() or "preview" in path.lower()))
                      or path.startswith('["'))

        keep = False
        if mode == 'ROOT' and is_hips_loc:
            keep = True
        elif mode == 'BODY' and is_bone and not is_hips_loc and not is_facial:
            keep = True

        if not keep:
            to_remove.append(fc)

    for fc in to_remove:
        cb.fcurves.remove(fc)

    if not list(cb.fcurves):
        bpy.data.actions.remove(new_act)
        return None
    return new_act


def make_face_action(seg_idx, seg_face_frames, armature):
    """
    Keyframe armature.data expression 'aa' from the lip sync JSON.
    Keyframes are inserted at absolute frames [0 .. seg_face_frames].
    Returns the action placed on armature.data.animation_data, or None.
    """
    ls_path = os.path.join(LS_DIR, f"traffic_{seg_idx:02d}.json")
    if not os.path.exists(ls_path):
        return None

    with open(ls_path) as f:
        ls = json.load(f)

    EXPR_PATH = "vrm_addon_extension.vrm1.expressions.preset.aa.preview"
    try:
        armature.data.vrm_addon_extension.vrm1.expressions.preset.aa.preview = 0.0
    except Exception as e:
        print(f"    [face] expression API unavailable: {e}")
        return None

    if not armature.data.animation_data:
        armature.data.animation_data_create()

    act = bpy.data.actions.new(f"_face_{seg_idx:02d}")
    armature.data.animation_data.action = act

    for cue in ls["mouthCues"]:
        weight = PHON_W.get(cue["value"], 0.0)
        for t in (cue["start"], cue["end"]):
            frame = round(t * FPS)
            armature.data.vrm_addon_extension.vrm1.expressions.preset.aa.preview = weight
            armature.data.keyframe_insert(data_path=EXPR_PATH, frame=frame)

    for fc in get_channelbag(act).fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'

    return act


def do_export(armature, mesh, out_path, f_start, f_end):
    bpy.context.scene.frame_start = f_start
    bpy.context.scene.frame_end   = f_end
    bpy.ops.object.select_all(action='DESELECT')
    armature.select_set(True)
    if mesh:
        mesh.select_set(True)
    bpy.context.view_layer.objects.active = armature
    VrmAnimationExporter.execute(bpy.context, Path(out_path), armature)


# ── MAIN ──────────────────────────────────────────────────────────────────────

os.makedirs(OUT_DIR, exist_ok=True)
print("\n══ TRAFFIC VRMA GENERATOR (Blender 5.0) ══")

# 1. Clear scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for action in list(bpy.data.actions):   bpy.data.actions.remove(action)
for mesh   in list(bpy.data.meshes):    bpy.data.meshes.remove(mesh)
for arm    in list(bpy.data.armatures): bpy.data.armatures.remove(arm)

# 2. Import VRM
print(f"[1] Importing VRM: {os.path.basename(VRM_IN)}")
bpy.ops.import_scene.vrm(filepath=VRM_IN)
armature = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
mesh     = next((o for o in bpy.data.objects
                 if o.type == 'MESH' and o.data and o.data.shape_keys), None)
if not armature:
    raise RuntimeError("No armature after VRM import")
hips_bone_name = get_hips_bone_name(armature)
print(f"   Armature: {armature.name}  Hips bone: '{hips_bone_name}'")

# 3. Import VRMA animation into armature
print(f"[2] Importing VRMA: {os.path.basename(VRMA_IN)}")
result = VrmAnimationImporter.execute(bpy.context, Path(VRMA_IN), armature)
print(f"   Result: {result}")
if 'CANCELLED' in result:
    raise RuntimeError("VrmAnimationImporter returned CANCELLED")

base_act = armature.animation_data.action
f_min = int(base_act.frame_range[0])
f_max = int(base_act.frame_range[1])
total_frames = f_max - f_min
print(f"   Action '{base_act.name}'  frames {f_min}–{f_max}  ({total_frames} frames, {total_frames/FPS:.1f}s)")

# 4. Compute proportional segment frame ranges
total_audio = sum(AUDIO_DURATIONS)
counts = [round((d / total_audio) * total_frames) for d in AUDIO_DURATIONS]
counts[-1] = round(total_frames - sum(counts[:-1]))
starts = []
cur = f_min
for c in counts:
    starts.append(cur)
    cur += c

print("\n   Segment plan:")
for i, (s, c) in enumerate(zip(starts, counts)):
    print(f"   {i:02d}: f{s}–{s+c}  ({c/FPS:.1f}s anim / {AUDIO_DURATIONS[i]}s audio)")

# 5. Generate segments
print("\n[3] Generating 36 VRMAs ...")
orig_fs = bpy.context.scene.frame_start
orig_fe = bpy.context.scene.frame_end

for i, (seg_start, seg_count) in enumerate(zip(starts, counts)):
    seg_end = seg_start + seg_count
    print(f"\n  ── seg {i:02d}  f{seg_start}–{seg_end} ──")

    # ROOT ─────────────────────────────────────────────────────────────────
    root_act = copy_filtered_action(base_act, 'ROOT', hips_bone_name)
    if root_act:
        armature.animation_data.action = root_act
        try:
            do_export(armature, None, os.path.join(OUT_DIR, f"seg_{i:02d}_root.vrma"), seg_start, seg_end)
            print(f"   ROOT ✓  ({Path(OUT_DIR, f'seg_{i:02d}_root.vrma').stat().st_size//1024}KB)")
        except Exception as e:
            print(f"   ROOT ERROR: {e}")
        bpy.data.actions.remove(root_act)
    else:
        print("   ROOT: no hips-location data, skipped")

    # BODY ─────────────────────────────────────────────────────────────────
    body_act = copy_filtered_action(base_act, 'BODY', hips_bone_name)
    if body_act:
        armature.animation_data.action = body_act
        try:
            do_export(armature, None, os.path.join(OUT_DIR, f"seg_{i:02d}_body.vrma"), seg_start, seg_end)
            print(f"   BODY ✓  ({Path(OUT_DIR, f'seg_{i:02d}_body.vrma').stat().st_size//1024}KB)")
        except Exception as e:
            print(f"   BODY ERROR: {e}")
        bpy.data.actions.remove(body_act)
    else:
        print("   BODY: no bone data, skipped")

    # FACE ─────────────────────────────────────────────────────────────────
    armature.animation_data.action = None   # no bone animation during face export
    face_frames = round(AUDIO_DURATIONS[i] * FPS)
    face_act = make_face_action(i, face_frames, armature)
    if face_act:
        try:
            do_export(armature, mesh, os.path.join(OUT_DIR, f"seg_{i:02d}_face.vrma"), 0, face_frames)
            print(f"   FACE ✓  ({Path(OUT_DIR, f'seg_{i:02d}_face.vrma').stat().st_size//1024}KB)")
        except Exception as e:
            print(f"   FACE ERROR: {e}")
        armature.data.animation_data.action = None
        bpy.data.actions.remove(face_act)
    else:
        print("   FACE: skipped")

    armature.animation_data.action = base_act  # restore for next iteration

# 6. Restore
bpy.context.scene.frame_start = orig_fs
bpy.context.scene.frame_end   = orig_fe
armature.animation_data.action = None

total = len(list(Path(OUT_DIR).glob("seg_*.vrma")))
print(f"\n══ DONE — {total} VRMAs in vrma/traffic/ ══")
