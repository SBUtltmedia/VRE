import json
import struct
import sys

def extract_gltf_json(file_path):
    with open(file_path, 'rb') as f:
        magic = f.read(4)
        if magic != b'glTF':
            print("Not a glTF file")
            return None
        version = struct.unpack('<I', f.read(4))[0]
        length = struct.unpack('<I', f.read(4))[0]
        chunk_length = struct.unpack('<I', f.read(4))[0]
        chunk_type = f.read(4)
        if chunk_type != b'JSON':
            print("First chunk is not JSON")
            return None
        json_data = f.read(chunk_length)
        return json.loads(json_data.decode('utf-8'))

def print_human_bones(vrm_path):
    data = extract_gltf_json(vrm_path)
    if not data:
        return
    
    # Try VRM 1.0
    vrm1 = data.get('extensions', {}).get('VRMC_vrm', {})
    if vrm1:
        print(f"--- VRM 1.0: {vrm_path} ---")
        human_bones = vrm1.get('humanoid', {}).get('humanBones', {})
        for name, bone in human_bones.items():
            node_idx = bone.get('node')
            node_name = data['nodes'][node_idx].get('name', f"node_{node_idx}")
            print(f"{name}: {node_name}")
        return

    # Try VRM 0.x
    vrm0 = data.get('extensions', {}).get('VRM', {})
    if vrm0:
        print(f"--- VRM 0.x: {vrm_path} ---")
        human_bones = vrm0.get('humanoid', {}).get('humanBones', [])
        for bone in human_bones:
            name = bone.get('bone')
            node_idx = bone.get('node')
            node_name = data['nodes'][node_idx].get('name', f"node_{node_idx}")
            print(f"{name}: {node_name}")
        return

    print(f"No VRM extension found in {vrm_path}")

if __name__ == "__main__":
    for arg in sys.argv[1:]:
        print_human_bones(arg)
