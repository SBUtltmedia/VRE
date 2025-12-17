import bpy
import sys

# File to check
filepath = "models/AIAN/AIAN_F_1_Casual_CLEANED.vrm"

print(f"\n--- INSPECTING: {filepath} ---")

# Clear scenepy.ops.wm.read_factory_settings(use_empty=True)

try:
    bpy.ops.import_scene.vrm(filepath=filepath)
except Exception as e:
    print(f"Import Failed: {e}")
    sys.exit()

# Find the face mesh
face = bpy.data.objects.get("H_DDS_HighRes")
if face and face.data.shape_keys:
    print(f"Face Mesh Found: {face.name}")
    print(f"Total Shape Keys: {len(face.data.shape_keys.key_blocks)}")
    
    # List all keys to see what's there
    keys = [kb.name for kb in face.data.shape_keys.key_blocks]
    
    # Check specifically for our phonemes
    phonemes = ["A", "E", "I", "O", "U", "F", "M"]
    found = []
    missing = []
    
    for p in phonemes:
        if p in keys:
            found.append(p)
        else:
            missing.append(p)
            
    print(f"Phonemes Found: {found}")
    print(f"Phonemes Missing: {missing}")
    
    # Print first 10 keys to give an idea of the list
    print(f"First 10 keys: {keys[:10]}")
    
else:
    print("Face mesh 'H_DDS_HighRes' not found or has no shape keys.")

print("------------------------------\n")
