#!/bin/bash
# Convert CMU MoCap BVH files to VRMA format using Blender

# Configuration
BLENDER="/Applications/Blender.app/Contents/MacOS/Blender"  # macOS path

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_SCRIPT="$SCRIPT_DIR/blender_bvh_to_vrma.py"

# Default directories
INPUT_DIR="$SCRIPT_DIR/cmu-mocap/data"
OUTPUT_DIR="$SCRIPT_DIR/cmu_mocap_vrma"
VRM_MODEL=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -i|--input)
            INPUT_DIR="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -v|--vrm-model)
            VRM_MODEL="$2"
            shift 2
            ;;
        -s|--single)
            SINGLE_FILE="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -i, --input DIR     Input directory (default: ./cmu-mocap/data)"
            echo "  -o, --output DIR    Output directory (default: ./cmu_mocap_vrma)"
            echo "  -v, --vrm-model     Reference VRM model (optional)"
            echo "  -s, --single FILE   Convert single file instead of batch"
            echo "  -h, --help          Show this help"
            echo ""
            echo "Examples:"
            echo "  $0                                           # Convert all BVH files"
            echo "  $0 -s ./cmu-mocap/data/01/01_01.bvh         # Convert single file"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# Check if Blender exists
if [ ! -f "$BLENDER" ] && ! command -v blender &> /dev/null; then
    echo "ERROR: Blender not found!"
    echo "Please edit this script and set the correct BLENDER path"
    echo "Current path: $BLENDER"
    exit 1
fi

# Build command
CMD="$BLENDER --background --python $PYTHON_SCRIPT -- --input-dir $INPUT_DIR --output-dir $OUTPUT_DIR"

if [ -n "$VRM_MODEL" ]; then
    CMD="$CMD --vrm-model $VRM_MODEL"
fi

if [ -n "$SINGLE_FILE" ]; then
    CMD="$CMD --single-file $SINGLE_FILE"
    echo "Converting single file: $SINGLE_FILE"
else
    echo "Starting batch conversion..."
    echo "  Input:  $INPUT_DIR"
    echo "  Output: $OUTPUT_DIR"
    echo ""
fi

# Run Blender
$CMD

echo ""
echo "Done! Check $OUTPUT_DIR for VRMA files."
