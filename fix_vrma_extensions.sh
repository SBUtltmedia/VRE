#!/bin/bash
# Rename all .vrma.glb files to .vrma

echo "Renaming .vrma.glb files to .vrma..."

count=0
find /Users/pstdenis/Downloads/VRE/cmu_mocap_vrma -name "*.vrma.glb" | while read file; do
    newfile="${file%.glb}"  # Remove .glb extension
    mv "$file" "$newfile"
    count=$((count + 1))
    if [ $((count % 100)) -eq 0 ]; then
        echo "Renamed $count files..."
    fi
done

echo "Done! Renamed all .vrma.glb files to .vrma"
echo ""
echo "Now regenerating animations.json..."
node /Users/pstdenis/Downloads/VRE/generate_animations_json.mjs
