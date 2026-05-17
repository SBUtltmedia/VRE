#!/usr/bin/env python3
"""
vrm_to_rigify.py
Import a VRM 1.0 file and auto-generate a matched Rigify control rig.

The generated .blend contains:
  • The original VRM armature + meshes
  • A positioned Rigify human metarig  (hidden after generation)
  • The generated Rigify control rig
  • Copy Rotation constraints on every VRM humanoid bone pointing at the
    matching Rigify DEF-bone — so you animate the Rigify rig and the VRM
    bones follow, ready for VRMA export.

CLI:
  blender --background --python vrm_to_rigify.py -- <vrm_path> [out.blend]

Blender Scripting workspace:
  Set VRM_PATH at the top and run.

Requirements:
  • Blender 4.2+ with Rigify add-on enabled
  • VRM Add-on for Blender (saturday06) — https://github.com/saturday06/VRM-Addon-for-Blender
"""

import bpy
import sys
import os
from mathutils import Vector

# ── CLI / UI config ───────────────────────────────────────────────────────────
def _parse_args():
    argv = sys.argv
    if "--" in argv:
        rest = argv[argv.index("--") + 1:]
        vrm  = rest[0] if len(rest) > 0 else ""
        out  = rest[1] if len(rest) > 1 else ""
    else:
        vrm = r"D:\VRE\models\Black\Black_M_1_Casual.vrm"
        out = ""
    return vrm, out

VRM_PATH, OUTPUT_PATH = _parse_args()
if not VRM_PATH:
    raise SystemExit("Usage: blender --bg --python vrm_to_rigify.py -- <vrm_path> [out.blend]")

VRM_PATH = os.path.abspath(VRM_PATH)
if not OUTPUT_PATH:
    stem = os.path.splitext(os.path.basename(VRM_PATH))[0]
    OUTPUT_PATH = os.path.join(os.path.dirname(VRM_PATH), stem + "_rigify.blend")

print(f"[vrm_to_rigify] VRM : {VRM_PATH}")
print(f"[vrm_to_rigify] OUT : {OUTPUT_PATH}")

# ── VRM humanoid attr (snake_case) → Rigify human metarig bone name ───────────
# Intermediate spine bones (spine.002) have no direct VRM equivalent and are
# positioned by interpolation between known neighbors.
VRM_TO_META = {
    "hips":           "spine",
    "spine":          "spine.001",
    "chest":          "spine.003",
    "upper_chest":    "spine.004",  # optional in VRM 1.0
    "neck":           "spine.005",
    "head":           "spine.006",
    "left_shoulder":  "shoulder.L",
    "left_upper_arm": "upper_arm.L",
    "left_lower_arm": "forearm.L",
    "left_hand":      "hand.L",
    "right_shoulder": "shoulder.R",
    "right_upper_arm":"upper_arm.R",
    "right_lower_arm":"forearm.R",
    "right_hand":     "hand.R",
    "left_upper_leg": "thigh.L",
    "left_lower_leg": "shin.L",
    "left_foot":      "foot.L",
    "left_toes":      "toe.L",
    "right_upper_leg":"thigh.R",
    "right_lower_leg":"shin.R",
    "right_foot":     "foot.R",
    "right_toes":     "toe.R",
}

# Rigify DEF-bone → VRM humanoid attr (for Copy Rotation constraints)
DEF_TO_VRM = {
    "DEF-spine":          "hips",
    "DEF-spine.001":      "spine",
    "DEF-spine.003":      "chest",
    "DEF-spine.004":      "upper_chest",
    "DEF-spine.005":      "neck",
    "DEF-spine.006":      "head",
    "DEF-shoulder.L":     "left_shoulder",
    "DEF-upper_arm.L":    "left_upper_arm",
    "DEF-forearm.L":      "left_lower_arm",
    "DEF-hand.L":         "left_hand",
    "DEF-shoulder.R":     "right_shoulder",
    "DEF-upper_arm.R":    "right_upper_arm",
    "DEF-forearm.R":      "right_lower_arm",
    "DEF-hand.R":         "right_hand",
    "DEF-thigh.L":        "left_upper_leg",
    "DEF-shin.L":         "left_lower_leg",
    "DEF-foot.L":         "left_foot",
    "DEF-toe.L":          "left_toes",
    "DEF-thigh.R":        "right_upper_leg",
    "DEF-shin.R":         "right_lower_leg",
    "DEF-foot.R":         "right_foot",
    "DEF-toe.R":          "right_toes",
}


# ── Enable required add-ons ───────────────────────────────────────────────────
for _addon in ('rigify',):
    try:
        bpy.ops.preferences.addon_enable(module=_addon)
    except Exception as _e:
        raise SystemExit(f"[vrm_to_rigify] ERROR: Could not enable '{_addon}': {_e}")

# ── Step 1: Clear default scene and import VRM ────────────────────────────────
print("[vrm_to_rigify] Clearing scene...")
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for block in list(bpy.data.meshes) + list(bpy.data.armatures) + list(bpy.data.materials):
    try: bpy.data.batch_remove([block])
    except: pass

print("[vrm_to_rigify] Importing VRM...")
bpy.ops.import_scene.vrm(filepath=VRM_PATH)

arm_obj = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
if arm_obj is None:
    raise SystemExit("[vrm_to_rigify] ERROR: No armature found after VRM import")
print(f"[vrm_to_rigify] Armature: {arm_obj.name}")


# ── Step 2: Read humanoid bone world positions from VRM addon ─────────────────
def read_humanoid_bones(arm_obj):
    """
    Returns dict: vrm_attr → { bone_name, head (world), tail (world) }
    Tries VRM 1.0 path first, falls back to VRM 0.x.
    """
    arm = arm_obj.data
    ext = arm.vrm_addon_extension
    hb  = None

    try:
        hb = ext.vrm1.humanoid.human_bones
        version = "1.0"
    except AttributeError:
        pass

    if hb is None:
        try:
            hb = ext.vrm0.humanoid.human_bones
            version = "0.x"
        except AttributeError:
            raise SystemExit("[vrm_to_rigify] ERROR: VRM addon not installed or no humanoid data")

    print(f"[vrm_to_rigify] VRM version: {version}")
    mw  = arm_obj.matrix_world
    out = {}

    for attr in VRM_TO_META:
        try:
            hbone = getattr(hb, attr, None)
            if hbone is None:
                continue
            # VRM 1.0: node.bone_name  |  VRM 0.x: bone_name
            bname = getattr(getattr(hbone, 'node', None), 'bone_name', None) \
                    or getattr(hbone, 'bone_name', None)
            if not bname or bname not in arm.bones:
                continue
            bone = arm.bones[bname]
            out[attr] = {
                "bone_name": bname,
                "head":      (mw @ bone.head_local).copy(),
                "tail":      (mw @ bone.tail_local).copy(),
            }
        except Exception as e:
            print(f"[vrm_to_rigify]   skip {attr}: {e}")

    return out


bone_data = read_humanoid_bones(arm_obj)
print(f"[vrm_to_rigify] Mapped {len(bone_data)} / {len(VRM_TO_META)} humanoid bones")
for attr, d in bone_data.items():
    h = d['head']
    print(f"  {attr:20s} → {d['bone_name']:30s}  {h.x:+.4f} {h.y:+.4f} {h.z:+.4f}")


# ── Step 3: Add the Rigify human metarig ─────────────────────────────────────
print("[vrm_to_rigify] Adding Rigify human metarig...")
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.object.armature_human_metarig_add()
meta_obj = bpy.context.active_object
meta_obj.name = arm_obj.name + "_metarig"


# ── Step 4: Position metarig bones to match VRM skeleton ─────────────────────
# Rigify uses connected bone chains: child.head MUST equal parent.tail exactly.
# We set both head AND tail for every bone in each chain so nothing is disjoint.

def world_to_meta(v):
    return meta_obj.matrix_world.inverted() @ v

def H(attr):
    """Head world position for a VRM bone (returns None if not mapped)."""
    return bone_data[attr]["head"] if attr in bone_data else None

def T(attr):
    """Tail world position of VRM bone (used for terminal bone tails)."""
    return bone_data[attr]["tail"] if attr in bone_data else None


bpy.ops.object.mode_set(mode='EDIT')
eb = meta_obj.data.edit_bones


def place(name, head_w, tail_w):
    b = eb.get(name)
    if b is None:
        print(f"[vrm_to_rigify]   meta bone not found: {name}")
        return
    b.head = world_to_meta(head_w)
    b.tail = world_to_meta(tail_w)


def lerp(a, b, t=0.5):
    return a + (b - a) * t


# ── Spine chain ──────────────────────────────────────────────────────────────
# spine → spine.001 → spine.002 → spine.003 → spine.004 → spine.005 → spine.006
# All connected; each bone's tail == next bone's head.

hips_h  = H("hips")
spn_h   = H("spine")       or lerp(hips_h, H("chest"), 0.33)
chest_h = H("chest")       or lerp(spn_h,  H("neck"),  0.5)
uch_h   = H("upper_chest") or lerp(chest_h, H("neck"), 0.5)
neck_h  = H("neck")        or lerp(uch_h,  H("head"),  0.5)
head_h  = H("head")

# intermediate: spine.002 has no VRM equivalent
mid2_h = lerp(spn_h, chest_h, 0.5)

# terminal tail for spine.006: extend upward by the head bone's own vector
head_t  = T("head") if T("head") else head_h + Vector((0, 0, 0.1))

place("spine",      hips_h,  spn_h)
place("spine.001",  spn_h,   mid2_h)
place("spine.002",  mid2_h,  chest_h)
place("spine.003",  chest_h, uch_h)
place("spine.004",  uch_h,   neck_h)
place("spine.005",  neck_h,  head_h)
place("spine.006",  head_h,  head_t)

# ── Left arm chain ────────────────────────────────────────────────────────────
ls_h = H("left_shoulder");  la_h = H("left_upper_arm")
lf_h = H("left_lower_arm"); lhand_h = H("left_hand");  lhand_t = T("left_hand")
if ls_h and la_h:
    place("shoulder.L",  ls_h,    la_h)
if la_h and lf_h:
    place("upper_arm.L", la_h,    lf_h)
if lf_h and lhand_h:
    place("forearm.L",   lf_h,    lhand_h)
if lhand_h and lhand_t:
    place("hand.L",      lhand_h, lhand_t)

# ── Right arm chain ───────────────────────────────────────────────────────────
rs_h = H("right_shoulder");  ra_h = H("right_upper_arm")
rf_h = H("right_lower_arm"); rhand_h = H("right_hand"); rhand_t = T("right_hand")
if rs_h and ra_h:
    place("shoulder.R",  rs_h,    ra_h)
if ra_h and rf_h:
    place("upper_arm.R", ra_h,    rf_h)
if rf_h and rhand_h:
    place("forearm.R",   rf_h,    rhand_h)
if rhand_h and rhand_t:
    place("hand.R",      rhand_h, rhand_t)

# ── Left leg chain ────────────────────────────────────────────────────────────
lul_h = H("left_upper_leg"); lll_h = H("left_lower_leg")
lft_h = H("left_foot");      lto_h = H("left_toes"); lto_t = T("left_toes")
if lul_h and lll_h:
    place("thigh.L", lul_h, lll_h)
if lll_h and lft_h:
    place("shin.L",  lll_h, lft_h)
if lft_h and lto_h:
    place("foot.L",  lft_h, lto_h)
if lto_h and lto_t:
    place("toe.L",   lto_h, lto_t)

# ── Right leg chain ───────────────────────────────────────────────────────────
rul_h = H("right_upper_leg"); rll_h = H("right_lower_leg")
rft_h = H("right_foot");      rto_h = H("right_toes"); rto_t = T("right_toes")
if rul_h and rll_h:
    place("thigh.R", rul_h, rll_h)
if rll_h and rft_h:
    place("shin.R",  rll_h, rft_h)
if rft_h and rto_h:
    place("foot.R",  rft_h, rto_h)
if rto_h and rto_t:
    place("toe.R",   rto_h, rto_t)

bpy.ops.object.mode_set(mode='OBJECT')
print("[vrm_to_rigify] Metarig positioned.")


# ── Step 5: Generate the Rigify control rig ───────────────────────────────────
print("[vrm_to_rigify] Generating Rigify rig...")
bpy.context.view_layer.objects.active = meta_obj
bpy.ops.object.mode_set(mode='POSE')

try:
    bpy.ops.pose.rigify_generate()
except Exception as e:
    raise SystemExit(f"[vrm_to_rigify] ERROR: Rigify generate failed: {e}\n"
                     "Ensure the Rigify add-on is enabled in Blender preferences.")

bpy.ops.object.mode_set(mode='OBJECT')

# Find the generated rig
rig_obj = bpy.data.objects.get("rig") or bpy.data.objects.get("RIG-" + arm_obj.name)
if rig_obj is None:
    candidates = [o for o in bpy.data.objects
                  if o.type == 'ARMATURE' and o not in (arm_obj, meta_obj)]
    rig_obj = candidates[0] if candidates else None

if rig_obj is None:
    print("[vrm_to_rigify] WARNING: Could not identify generated rig. Skipping constraints.")
else:
    print(f"[vrm_to_rigify] Rigify rig: {rig_obj.name}")

    # ── Step 6: Wire VRM bones → Rigify DEF-bones via Copy Rotation ──────────
    print("[vrm_to_rigify] Adding Copy Rotation constraints on VRM armature...")
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='POSE')
    added = 0

    for def_name, vrm_attr in DEF_TO_VRM.items():
        if vrm_attr not in bone_data:
            continue
        vrm_bone_name = bone_data[vrm_attr]["bone_name"]
        pb = arm_obj.pose.bones.get(vrm_bone_name)
        if pb is None:
            continue
        if def_name not in rig_obj.data.bones:
            print(f"[vrm_to_rigify]   DEF-bone absent: {def_name}")
            continue

        # Remove any previous constraint from a prior run
        for old in [c for c in pb.constraints if c.name == "Rigify_CopyRot"]:
            pb.constraints.remove(old)

        con = pb.constraints.new('COPY_ROTATION')
        con.name         = "Rigify_CopyRot"
        con.target       = rig_obj
        con.subtarget    = def_name
        con.mix_mode     = 'REPLACE'
        con.owner_space  = 'LOCAL'
        con.target_space = 'LOCAL'
        added += 1
        print(f"  {vrm_bone_name:35s} ← {def_name}")

    bpy.ops.object.mode_set(mode='OBJECT')
    print(f"[vrm_to_rigify] {added} constraints added.")

# Hide the metarig (it's scaffolding; the generated rig is what you use)
meta_obj.hide_set(True)
meta_obj.hide_render = True


# ── Step 7: Save ─────────────────────────────────────────────────────────────
os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=OUTPUT_PATH)
print(f"[vrm_to_rigify] Saved: {OUTPUT_PATH}")
print("[vrm_to_rigify] Done! Open the .blend to animate with the Rigify rig.")
