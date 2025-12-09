#!/bin/bash
# Helper script to run Blender batch conversion

# Configuration
BLENDER="/Applications/Blender.app/Contents/MacOS/Blender"  # macOS path
# BLENDER="blender"  # Uncomment for Linux/Windows if Blender is in PATH

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_SCRIPT="$SCRIPT_DIR/blender_batch_convert.py"

# Default directories
INPUT_DIR="$SCRIPT_DIR/cmu_fbx/CMU_fbx"
OUTPUT_DIR="$SCRIPT_DIR/converted_mocap"
FORMAT="fbx"

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
        -f|--format)
            FORMAT="$2"
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
            echo "  -i, --input DIR     Input directory (default: ./cmu_fbx/CMU_fbx)"
            echo "  -o, --output DIR    Output directory (default: ./converted_mocap)"
            echo "  -f, --format FMT    Output format: fbx, gltf, vrma (default: fbx)"
            echo "  -s, --single FILE   Convert single file instead of batch"
            echo "  -h, --help          Show this help"
            echo ""
            echo "Examples:"
            echo "  $0                                    # Convert all FBX files"
            echo "  $0 -f gltf                            # Convert to glTF format"
            echo "  $0 -s ./cmu_fbx/CMU_fbx/01_01.fbx    # Convert single file"
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

# Run Blender command
if [ -n "$SINGLE_FILE" ]; then
    # Single file conversion
    echo "Converting single file: $SINGLE_FILE"
    "$BLENDER" --background --python "$PYTHON_SCRIPT" -- \
        --input-dir "$INPUT_DIR" \
        --output-dir "$OUTPUT_DIR" \
        --format "$FORMAT" \
        --single-file "$SINGLE_FILE"
else
    # Batch conversion
    echo "Starting batch conversion..."
    echo "  Input:  $INPUT_DIR"
    echo "  Output: $OUTPUT_DIR"
    echo "  Format: $FORMAT"
    echo ""

    "$BLENDER" --background --python "$PYTHON_SCRIPT" -- \
        --input-dir "$INPUT_DIR" \
        --output-dir "$OUTPUT_DIR" \
        --format "$FORMAT"
fi

echo ""
echo "Done! Check $OUTPUT_DIR for converted files."
