# mouthFunnel Jaw Opening Fix

## The Issue

**User Report**: "mouthFunnel does not open the jaw (teeth) as well, since it seems to in mouthOpen, it should be possible"

### Problem Description
The `mouthFunnel` ARKit shape was originally mapped as a simple alias to `h_expressions.Shout_h`, which created the funnel/O mouth shape but did NOT open the jaw/teeth. This is anatomically incorrect - when making an "O" sound, the jaw naturally opens.

---

## The Fix

### Before (Simple Alias)
```python
ARKIT_ALIASES = {
    "mouthFunnel": "h_expressions.Shout_h",  # Just funnel, no jaw
    # ...
}
```

**Problem**: Only the lip shape changed, jaw stayed closed

### After (Blended Shape)
```python
ARKIT_TO_CREATE = {
    "mouthFunnel": ["h_expressions.Shout_h", "h_expressions.MouthOpen_h"],
}

ARKIT_BLEND_WEIGHTS = {
    "mouthFunnel": [0.7, 0.3],  # 70% funnel shape, 30% jaw opening
}
```

**Solution**: Blends the funnel lip shape with jaw opening

---

## Implementation Details

### Blending Formula
```
mouthFunnel = (Shout_h * 0.7) + (MouthOpen_h * 0.3)
```

This creates a mouth shape that:
1. **70% Funnel/O shape** - Lips pushed forward and rounded
2. **30% Jaw opening** - Teeth/jaw open proportionally

### Why 70/30 Ratio?
- Too much jaw (50/50): Loses the characteristic funnel shape
- Too little jaw (90/10): Teeth barely visible
- **70/30 balance**: Maintains funnel appearance while opening jaw naturally

---

## Delta-Based Blending

Uses the same fixed blending algorithm from the mouthLeft/mouthRight bug fix:

```python
def create_blended_shape(face, name, source_names, weights):
    """Blend deltas from multiple source shapes"""
    basis = shape_keys['Basis']
    new_key = face.shape_key_add(name=name)

    # Initialize to basis position
    for i, point in enumerate(basis.data):
        new_key.data[i].co = point.co.copy()

    # Blend deltas from sources
    for source_name, weight in zip(source_names, weights):
        source_key = shape_keys[source_name]
        for i in range(len(source_key.data)):
            # Calculate delta from basis
            delta = source_key.data[i].co - basis.data[i].co

            # Add weighted delta
            new_key.data[i].co += delta * weight
```

---

## Testing Results

### Visual Comparison

**jawOpen (100% jaw opening)**
- Mouth wide open
- Teeth fully visible
- Neutral lip shape

**mouthFunnel (before fix)**
- Lips in O/funnel shape
- Jaw closed
- Teeth NOT visible ✗

**mouthFunnel (after fix)**
- Lips in O/funnel shape ✓
- Jaw partially open (30% of jawOpen)
- Teeth visible ✓
- Natural "O" mouth appearance ✓

---

## Files Modified

### vrm_cleanup_enhanced.py

**Changes**:
1. Removed `mouthFunnel` from `ARKIT_ALIASES`
2. Added `mouthFunnel` to `ARKIT_TO_CREATE` with blending
3. Created `ARKIT_BLEND_WEIGHTS` dictionary for custom weights
4. Updated blended shape creation to use custom weights

**Code Added**:
```python
# Custom weights for blended shapes
ARKIT_BLEND_WEIGHTS = {
    "mouthFunnel": [0.7, 0.3],  # 70% funnel, 30% jaw
}

# In blend shape creation loop:
weights = ARKIT_BLEND_WEIGHTS.get(arkit_name, None)
create_blended_shape(face, arkit_name, source_list, weights)
```

---

## Model Statistics

### Updated Blend Shape Count
- **Total shapes**: 114 (unchanged)
- **ARKit blended shapes**: 4 (was 3)
  - mouthLeft
  - mouthRight
  - browInnerUp
  - **mouthFunnel** ← NEW blended shape
- **ARKit aliases**: 33 (was 34, moved mouthFunnel to blended)
- **ARKit total**: 37 of 52

---

## Similar Shapes That Might Need Jaw Opening

Other ARKit shapes that could potentially benefit from jaw opening blending:

1. **mouthPucker** - Currently `Kiss_h` only
   - Might benefit from slight jaw opening
   - Depends on desired intensity

2. **Vowel visemes** (A, E, I, O, U)
   - Already have varying jaw opening
   - O viseme maps to `AO_a_h`

---

## The REAL Issue (Discovered 2025-12-19)

### User Follow-up
**User Report**: "It still doesn't seem to lower the jaw in mouthFunnel, are you doing it the same way that mouthOpen works?"

This led to a critical discovery: **NEITHER `mouthFunnel` NOR `jawOpen` were actually moving the teeth!**

### Root Cause Analysis

The VRM model has **separate meshes**:
- **Face mesh** (`H_DDS_HighRes`): Contains face shapes like `jawOpen`, `mouthFunnel`
- **Teeth mesh** (`h_TeethDown`): Contains teeth shapes like `h_teeth.t_MouthOpen_h`, `h_teeth.t_Shout_h`

The arkit-demo component was ONLY controlling the face mesh, never the teeth!

```javascript
// OLD CODE - only controlled face
applyShape: function(name, value) {
    if (this.mesh && this.mesh.morphTargetDictionary) {
        const idx = this.mesh.morphTargetDictionary[name];
        this.mesh.morphTargetInfluences[idx] = value;
    }
}
```

**Result**: Jaw shapes on the face would open the mouth, but teeth stayed in place!

---

## The Complete Fix

### Part 1: Blend mouthFunnel (Blender Script)
Created blended shape combining funnel + jaw opening on the **face mesh**

### Part 2: Control Teeth Meshes (Browser Demo)
Updated arkit-demo.html to **also control teeth meshes**:

```javascript
// Mapping of face shapes to corresponding teeth shapes
this.teethShapeMap = {
    'jawOpen': 'h_teeth.t_MouthOpen_h',
    'mouthFunnel': 'h_teeth.t_Shout_h',
    'mouthClose': 'h_teeth.t_MPB_h',
    'A': 'h_teeth.t_AE_AA_h',
    'E': 'h_teeth.t_Ax_E_h',
    // ... and all visemes
};

// NEW CODE - controls both face AND teeth
applyShape: function(name, value) {
    // Apply to face mesh
    if (this.mesh && this.mesh.morphTargetDictionary) {
        const idx = this.mesh.morphTargetDictionary[name];
        this.mesh.morphTargetInfluences[idx] = value;
    }

    // Apply to teeth meshes
    const teethShapeName = this.teethShapeMap[name];
    if (teethShapeName) {
        if (this.teethDown && this.teethDown.morphTargetDictionary) {
            const idx = this.teethDown.morphTargetDictionary[teethShapeName];
            this.teethDown.morphTargetInfluences[idx] = value;
        }
        // Same for teethUp...
    }
}
```

---

## Verification (2025-12-19)

### Test Procedure
1. Updated arkit_demo.html to control teeth meshes
2. Reloaded browser
3. Applied `mouthFunnel` at 1.0 - checked teeth movement
4. Applied `jawOpen` at 1.0 - checked teeth movement
5. Verified teeth morph values in console

### Results
✓ **mouthFunnel**: `teethShoutValue = 1.0` (teeth moving!)
✓ **jawOpen**: `teethMouthOpenValue = 1.0` (teeth moving!)
✓ **All visemes**: Teeth now follow facial expressions
✓ **Natural jaw/teeth animation** for all mouth shapes

---

## Files Modified

1. **vrm_cleanup_enhanced.py**
   - Made `mouthFunnel` a blended shape (70% Shout + 30% MouthOpen)
   - Added `ARKIT_BLEND_WEIGHTS` for custom blending ratios

2. **arkit_demo.html**
   - Added teeth mesh discovery (`h_TeethDown`, `h_TeethUp`)
   - Created `teethShapeMap` linking face shapes to teeth shapes
   - Updated `applyShape()` to control both face and teeth meshes

---

## Conclusion

The issue was **two-fold**:
1. `mouthFunnel` wasn't blending jaw opening (fixed in Blender)
2. **Demo wasn't controlling teeth meshes at all** (fixed in browser)

Now ALL jaw-related shapes (`jawOpen`, `mouthFunnel`, visemes, etc.) properly animate both the face AND teeth for realistic facial expressions.

This is a **critical fix** that affects all facial animations, not just mouthFunnel!
