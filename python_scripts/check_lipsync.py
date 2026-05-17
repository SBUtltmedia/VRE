import bpy
import addon_utils

print("\n--- CHECKING LIP SYNC ADDON ---")
installed = [mod.__name__ for mod in addon_utils.modules()]
enabled = [mod.__name__ for mod in addon_utils.modules() if addon_utils.check(mod.__name__)[0]]

lip_sync_addons = [name for name in installed if "lip" in name.lower() or "sync" in name.lower() or "iocg" in name.lower()]
print(f"Lip/Sync related addons found: {lip_sync_addons}")

if lip_sync_addons:
    for addon in lip_sync_addons:
        is_enabled = addon in enabled
        print(f"  - {addon}: {{'Enabled' if is_enabled else 'Disabled'}}")
else:
    print("NO LIP SYNC ADDONS FOUND.")
print("-------------------------------\n")
