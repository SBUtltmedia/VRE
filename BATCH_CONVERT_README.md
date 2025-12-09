# CMU MoCap Batch Conversion with Blender

This toolset converts CMU Motion Capture FBX files (which use unsupported "Spherical XYZ" Euler order) into formats that work correctly with VRM models.

## The Problem

CMU MoCap FBX files use a "Spherical XYZ" rotation representation that THREE.js FBXLoader doesn't support, resulting in distorted animations. Blender can properly import these files and re-export them with standard Euler angles.

## Requirements

1. **Blender 3.0+** (preferably latest version)
   - Download: https://www.blender.org/download/
   - Make sure you know the path to the Blender executable

2. **Your CMU MoCap FBX files**
   - Should be in `./cmu_fbx/CMU_fbx/` or specify custom path

## Quick Start

### Step 1: Make the script executable

```bash
chmod +x convert_mocap.sh
```

### Step 2: Update Blender path (if needed)

Edit `convert_mocap.sh` and set the correct Blender path for your system:

```bash
# macOS (default)
BLENDER="/Applications/Blender.app/Contents/MacOS/Blender"

# Linux (if Blender is in PATH)
BLENDER="blender"

# Windows (example)
BLENDER="C:/Program Files/Blender Foundation/Blender 4.0/blender.exe"
```

### Step 3: Run the conversion

#### Convert all FBX files to corrected FBX:
```bash
./convert_mocap.sh
```

#### Convert to glTF format:
```bash
./convert_mocap.sh --format gltf
```

#### Convert a single file:
```bash
./convert_mocap.sh --single ./cmu_fbx/CMU_fbx/01_01.fbx
```

#### Custom directories:
```bash
./convert_mocap.sh \
    --input ./my_mocap_files \
    --output ./my_converted_files \
    --format fbx
```

## Output Formats

### FBX (Recommended)
- Outputs: `*_converted.fbx` files with standard XYZ Euler order
- Use these directly in your existing `fbx-animation` component
- Best compatibility with THREE.js FBXLoader

### glTF
- Outputs: `*.gltf` + `*.bin` files
- Standard format, excellent compatibility
- Can use with THREE.js GLTFLoader

### VRMA (Not Yet Implemented)
- Would require VRM addon and reference VRM model
- Coming in future update if needed

## Manual Conversion (Alternative)

If you prefer to convert files manually in Blender GUI:

1. Open Blender
2. **File → Import → FBX (.fbx)**
   - Enable "Manual Orientation"
   - Set "Forward" to "-Z Forward"
   - Set "Up" to "Y Up"
   - Enable "Bake Space Transform"
   - Set "Scale" to 0.01

3. **File → Export → FBX (.fbx)**
   - Enable "Bake Animation"
   - Set "Forward" to "-Z Forward"
   - Set "Up" to "Y Up"
   - Enable "Apply Scalings" → "FBX All"
   - Enable "Add Leaf Bones" → OFF
   - Set Primary/Secondary bone axis as needed

4. Save to your output directory

## Troubleshooting

### "Blender not found"
- Edit `convert_mocap.sh` and set the correct `BLENDER` path
- On macOS: Check `/Applications/Blender.app/Contents/MacOS/Blender`
- On Linux: Try `which blender` to find the path
- On Windows: Check `C:\Program Files\Blender Foundation\`

### Conversion fails or produces bad results
- Try updating to the latest Blender version
- Check that input FBX files are valid (try opening in Blender manually)
- Enable more detailed logging by running Blender command directly:

```bash
blender --background --python blender_batch_convert.py -- \
    --input-dir ./cmu_fbx/CMU_fbx \
    --output-dir ./converted_mocap \
    --format fbx
```

### Animations still look wrong
- The converted FBX files should have standard Euler angles
- Make sure you're loading the `*_converted.fbx` files, not the originals
- You may still need to adjust the `boneMapping` in `aframe-fbx-retarget.js` for your specific VRM model

## Using Converted Files

After conversion, update your HTML to use the converted files:

```html
<a-entity vrm="src: models/Asian/Asian_F_1_Busi.vrm;"
          fbx-animation="src: converted_mocap/01_01_converted.fbx"
          position="-0.6 0 -1.5"
          rotation="0 180 0">
</a-entity>
```

You can also remove or simplify the rotation corrections in `aframe-fbx-retarget.js` since the Euler angles are now standard.

## Batch Processing Large Datasets

For converting all CMU MoCap files (~2500 animations):

```bash
# Convert all at once (may take hours)
./convert_mocap.sh

# Or convert in chunks
./convert_mocap.sh --input ./cmu_fbx/CMU_fbx --pattern "01_*.fbx"
./convert_mocap.sh --input ./cmu_fbx/CMU_fbx --pattern "02_*.fbx"
# etc...
```

## Next Steps

1. Convert a few test files first
2. Verify they work in your A-Frame scene
3. Batch convert the rest
4. Optionally remove rotation correction code from `aframe-fbx-retarget.js`

## Support

If you encounter issues:
- Check Blender console output for errors
- Verify input files are valid CMU MoCap FBX format
- Try manual conversion in Blender GUI first
- Check that output files are being created

## License

This conversion toolset is provided as-is for working with CMU Motion Capture data.
