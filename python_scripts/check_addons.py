import bpy
import addon_utils

print("\n--- CHECKING ADDONS ---")
installed = [mod.__name__ for mod in addon_utils.modules()]
enabled = [mod.__name__ for mod in addon_utils.modules() if addon_utils.check(mod.__name__)[0]]

print(f"Total installed addons: {len(installed)}")
print(f"Total enabled addons: {len(enabled)}")

vrm_addons = [name for name in installed if "vrm" in name.lower()]
print(f"VRM-related addons found: {vrm_addons}")

if vrm_addons:
    for addon in vrm_addons:
        is_enabled = addon in enabled
        print(f"  - {addon}: {{'Enabled' if is_enabled else 'Disabled'}}")
else:
    print("NO VRM ADDONS FOUND.")
print("-----------------------\n")
