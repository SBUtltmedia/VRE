import bpy

print("\n--- CHECKING OPERATORS ---")
ops = dir(bpy.ops)
print(f"Top-level ops categories: {len(ops)}")

# Check import_scene
if hasattr(bpy.ops, "import_scene"):
    print("import_scene operators:")
    for op in dir(bpy.ops.import_scene):
        print(f"  - {op}")

# Search for any operator with 'vrm'
print("\nSearching for 'vrm' in all operators:")
for cat in dir(bpy.ops):
    try:
        category = getattr(bpy.ops, cat)
        for op in dir(category):
            if "vrm" in op.lower():
                print(f"  - bpy.ops.{cat}.{op}")
    except:
        pass

print("--------------------------\n")


