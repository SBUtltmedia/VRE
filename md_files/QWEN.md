# QWEN Project Context

## Project Overview
This project uses Babylon.js to load and play VRM/VRMA animations in sequence to create scenes. The main focus is currently on automating the improvement of ARKit 52 blendshapes in existing VRM files that are based on Google VALID avatars.

## Key Files
- `improve_blendshape.py`: Python script that improves blendshapes in VRM files using Blender as a backend
- `improve_all_blendshapes.py`: Batch script to improve all ARKit blendshapes at once
- Multiple Babylon.js HTML files for loading and playing VRM animations
- Various animation-related documentation files

## side_by_side_scene.html Configuration
The scene shows two characters:
- **Hero**: Female VALID avatar using "models/Asian/Asian_F_1_Casual.vrm"
- **Stranger**: Male VALID avatar using "models/Black/Black_M_1_Busi.vrm"

Both characters are loaded from the VALID avatars collection at https://media.githubusercontent.com/media/TLTMedia/valid-vrm-avatars/master/

## improve_blendshape.py Details
This Blender Python script:
- Takes a reference VRM/VRMA model (MetaHuman) and a target VRM model (VALID avatar)
- Transfers specific blendshape data from reference to target
- Focuses on improving ARKit 52 blendshapes
- Outputs an improved GLB file

### Usage
```
python improve_blendshape.py -- <reference_path> <target_path> <shape_name> <output_path>
```

### Arguments
- `ref_path`: Path to reference VRM file (MetaHuman)
- `target_path`: Path to target VRM file to improve (VALID avatar)
- `shape_name`: Specific blendshape name to transfer
- `output_path`: Output path for the improved GLB file

## improve_all_blendshapes.py Details
Batch script that improves all ARKit blendshapes:
- Uses MetaHuman as the reference model
- Processes all 52 ARKit blendshapes automatically
- Creates individual improved GLB files for each blendshape

## Testing Results
- Blender 5.0 is installed and working correctly
- VRM import functionality is working with MetaHuman models
- MetaHuman models have 52 shape keys including ARKit blendshapes
- Successfully created 13 improved VRM models with different blendshape improvements
- Script successfully transfers shape data when the specified blendshape exists in both models

## Available ARKit Blendshapes
Key blendshapes include: Basis, eyeBlinkLeft, eyeBlinkRight, eyeLookDownLeft, eyeLookDownRight, eyeLookInLeft, eyeLookInRight, eyeLookOutLeft, eyeLookOutRight, eyeLookUpLeft, eyeLookUpRight, jawForward, jawLeft, jawRight, jawOpen, mouthLeft, mouthRight, mouthSmileLeft, mouthSmileRight, mouthFrownLeft, mouthFrownRight, etc.

## Status
Script is functional and ready for production use. Successfully processed multiple blendshapes and created improved VRM models. The male VALID avatar (Black_M_1_Busi.vrm) has been processed with various blendshape improvements using MetaHuman as reference.