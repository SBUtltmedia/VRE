import bpy
import sys

# Import the VRM
bpy.ops.import_scene.vrm(filepath='models/AIAN/AIAN_F_1_Casual_CLEANED.vrm')

# Check face shapes
face = bpy.data.objects.get('H_DDS_HighRes')
teeth_up = bpy.data.objects.get('h_TeethUp')
teeth_down = bpy.data.objects.get('h_TeethDown')

print("\n=== FACE MESH SHAPES ===")
if face and face.data.shape_keys:
    face_shapes = face.data.shape_keys.key_blocks
    print(f"Has jawOpen: {'jawOpen' in face_shapes}")
    print(f"Has mouthFunnel: {'mouthFunnel' in face_shapes}")
    print(f"Has MouthOpen_h: {'h_expressions.MouthOpen_h' in face_shapes}")

print("\n=== TEETH UP SHAPES ===")
if teeth_up and teeth_up.data.shape_keys:
    teeth_shapes = teeth_up.data.shape_keys.key_blocks
    print(f"Total teeth_up shapes: {len(teeth_shapes)}")
    # Look for mouth/jaw/open related teeth shapes
    for key in teeth_shapes:
        if 'mouth' in key.name.lower() or 'jaw' in key.name.lower() or 'open' in key.name.lower() or 'shout' in key.name.lower():
            print(f"  - {key.name}")
            # Check if it has a driver
            try:
                driver = key.driver_add("value").driver if not key.id_data.animation_data else None
                if key.id_data.animation_data:
                    for fcurve in key.id_data.animation_data.drivers:
                        if fcurve.data_path == f'key_blocks["{key.name}"].value':
                            print(f"    Has driver!")
                            if fcurve.driver.variables:
                                for var in fcurve.driver.variables:
                                    if var.targets and var.targets[0].id:
                                        print(f"      Target: {var.targets[0].data_path}")
            except:
                pass

print("\n=== TEETH DOWN SHAPES ===")
if teeth_down and teeth_down.data.shape_keys:
    teeth_shapes = teeth_down.data.shape_keys.key_blocks
    print(f"Total teeth_down shapes: {len(teeth_shapes)}")
    for key in teeth_shapes:
        if 'mouth' in key.name.lower() or 'jaw' in key.name.lower() or 'open' in key.name.lower() or 'shout' in key.name.lower():
            print(f"  - {key.name}")
            try:
                if key.id_data.animation_data:
                    for fcurve in key.id_data.animation_data.drivers:
                        if fcurve.data_path == f'key_blocks["{key.name}"].value':
                            print(f"    Has driver!")
                            if fcurve.driver.variables:
                                for var in fcurve.driver.variables:
                                    if var.targets and var.targets[0].id:
                                        print(f"      Target: {var.targets[0].data_path}")
            except:
                pass
