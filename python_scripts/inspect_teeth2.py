import bpy

# Import the VRM
bpy.ops.import_scene.vrm(filepath='models/AIAN/AIAN_F_1_Casual_CLEANED.vrm')

# Get meshes
face = bpy.data.objects.get('H_DDS_HighRes')
teeth_up = bpy.data.objects.get('h_TeethUp')
teeth_down = bpy.data.objects.get('h_TeethDown')

print("\n=== CHECKING TEETH SHAPES FOR MOUTHOPEN/SHOUT ===\n")

# Check if teeth have MouthOpen or Shout shapes
if teeth_down and teeth_down.data.shape_keys:
    print("TEETH DOWN shapes:")
    for key in teeth_down.data.shape_keys.key_blocks:
        print(f"  - {key.name}")

    # Check for specific shapes
    print("\nChecking for jaw/mouth related:")
    if "h_teeth.t_MouthOpen_h" in teeth_down.data.shape_keys.key_blocks:
        print("  ✓ Has h_teeth.t_MouthOpen_h")
    if "h_teeth.t_Shout_h" in teeth_down.data.shape_keys.key_blocks:
        print("  ✓ Has h_teeth.t_Shout_h")

if teeth_up and teeth_up.data.shape_keys:
    print("\nTEETH UP shapes:")
    for key in teeth_up.data.shape_keys.key_blocks:
        print(f"  - {key.name}")

    print("\nChecking for jaw/mouth related:")
    if "h_teeth.t_MouthOpen_h" in teeth_up.data.shape_keys.key_blocks:
        print("  ✓ Has h_teeth.t_MouthOpen_h")
    if "h_teeth.t_Shout_h" in teeth_up.data.shape_keys.key_blocks:
        print("  ✓ Has h_teeth.t_Shout_h")

# Check drivers
print("\n=== CHECKING DRIVERS ===\n")
if teeth_down and teeth_down.data.shape_keys and teeth_down.data.shape_keys.animation_data:
    print("Teeth down drivers:")
    for fcurve in teeth_down.data.shape_keys.animation_data.drivers:
        print(f"  {fcurve.data_path}")
        if fcurve.driver.variables:
            for var in fcurve.driver.variables:
                if var.targets and var.targets[0].id:
                    print(f"    → {var.targets[0].data_path}")
else:
    print("No drivers on teeth_down")

if teeth_up and teeth_up.data.shape_keys and teeth_up.data.shape_keys.animation_data:
    print("\nTeeth up drivers:")
    for fcurve in teeth_up.data.shape_keys.animation_data.drivers:
        print(f"  {fcurve.data_path}")
        if fcurve.driver.variables:
            for var in fcurve.driver.variables:
                if var.targets and var.targets[0].id:
                    print(f"    → {var.targets[0].data_path}")
else:
    print("No drivers on teeth_up")
