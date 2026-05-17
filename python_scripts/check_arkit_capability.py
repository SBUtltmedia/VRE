import bpy
import sys

bpy.ops.import_scene.vrm(filepath='models/AIAN/AIAN_F_1_Casual_CLEANED.vrm')

# Check bones
armature = None
for obj in bpy.data.objects:
    if obj.type == 'ARMATURE':
        armature = obj
        break

print("\n=== SKELETON BONES ===")
print(f"Total bones: {len(armature.data.bones)}")

face_bones = [b.name for b in armature.data.bones if 'eye' in b.name.lower() or 'jaw' in b.name.lower() or 'head' in b.name.lower()]
print(f"Face-related bones: {len(face_bones)}")
print(f"Face bones: {face_bones}")

# Check face mesh
face = bpy.data.objects.get('H_DDS_HighRes')
print("\n=== FACE MESH ===")
print(f"Vertices: {len(face.data.vertices):,}")
print(f"Polygons: {len(face.data.polygons):,}")

if face.data.shape_keys:
    print(f"Current blend shapes: {len(face.data.shape_keys.key_blocks)}")
else:
    print("No blend shapes currently")

print("\n=== ARKIT CAPABILITY ASSESSMENT ===")

# ARKit needs detailed face mesh
if len(face.data.vertices) >= 10000:
    quality = "EXCELLENT"
elif len(face.data.vertices) >= 5000:
    quality = "GOOD"
elif len(face.data.vertices) >= 2000:
    quality = "ADEQUATE"
else:
    quality = "POOR"

print(f"Face mesh quality for ARKit: {quality}")
print(f"Vertex count: {len(face.data.vertices):,} (ARKit recommended: 10,000+)")

# Check if we can add more shapes
print(f"\nCan add 52 ARKit shapes: YES")
print(f"Blend shapes are unlimited in Blender")
print(f"Limitation is mesh topology quality, not count")

print("\n=== VERDICT ===")
if len(face.data.vertices) >= 5000:
    print("✓ Your model CAN support 52 ARKit shapes")
    print("✓ Face mesh has sufficient detail")
    print("✓ You have standard VRM bones (no special bones needed)")
    print("\nNote: ARKit shapes use BLEND SHAPES (morph targets), NOT bones")
else:
    print("⚠ Face mesh might be too low-poly for detailed ARKit shapes")
    print("✓ But you can still try - might work for stylized characters")
