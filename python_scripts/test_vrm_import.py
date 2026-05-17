import bpy
import sys

# Test VRM import
print("Starting VRM import test...")

bpy.ops.wm.read_factory_settings(use_empty=True)

try:
    bpy.ops.import_scene.gltf(filepath="D:/VRE/models/MetaHuman/MetaHuman.vrm")
    print("VRM import successful!")
    
    # Find mesh objects
    meshes = [obj for obj in bpy.data.objects if obj.type == 'MESH']
    print(f"Found {len(meshes)} mesh objects")
    
    for mesh in meshes:
        if hasattr(mesh.data, 'shape_keys') and mesh.data.shape_keys:
            print(f"Mesh '{mesh.name}' has {len(mesh.data.shape_keys.key_blocks)} shape keys")
            print(f"Shape keys: {[s.name for s in mesh.data.shape_keys.key_blocks[:5]]}...")
    
except Exception as e:
    print(f"Error importing VRM: {e}")