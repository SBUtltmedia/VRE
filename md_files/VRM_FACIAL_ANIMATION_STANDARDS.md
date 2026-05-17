# VRM Facial Animation Standards (or Lack Thereof)

## The Reality: No Official Viseme Standard

**There is NO official VRM specification for lip-sync/viseme animations.**

### What VRM DOES Specify

#### VRM 0.x (BlendShapeProxy)
The VRM 0.x spec defines these **expression presets**:

```
Emotions:
- neutral
- joy
- angry
- sorrow
- fun

Basic Vowels (optional):
- a
- i
- u
- e
- o

Eye/Blink:
- blink
- blink_l
- blink_r

Looking:
- lookup
- lookdown
- lookleft
- lookright
```

**Note**: Only `a, i, u, e, o` relate to mouth shapes, and they're OPTIONAL. No consonants are specified.

#### VRM 1.0 (ExpressionManager)
VRM 1.0 has more flexibility but still defines similar presets:

```
Preset Expressions:
- happy
- angry
- sad
- relaxed
- surprised

Mouth (optional):
- aa (like "a" in VRM 0.x)
- ih (like "i")
- ou (like "o")
- ee (like "e")
- oh (another O variant)
```

**Still no standard for detailed phonemes/visemes!**

---

## What VRMA Actually Specifies

From the official spec at https://vrm.dev/en/vrma/:

### VRMA Format
VRMA is an extension of glTF animations. It supports:

1. **Node (bone) animations**
   - Translation, Rotation, Scale keyframes
   - Standard skeletal animation

2. **MorphTarget (blend shape) animations**
   - Weight keyframes for morph targets
   - Generic support - NO naming convention specified

### Example VRMA Structure
```json
{
  "animations": [{
    "tracks": [
      {
        "type": "vector3",
        "name": "Hips.position",
        "times": [0, 1, 2],
        "values": [...]
      },
      {
        "type": "number",
        "name": "SomeMesh.morphTargetInfluences[0]",
        "times": [0, 1, 2],
        "values": [0, 1, 0]
      }
    ]
  }]
}
```

**Key Point**: VRMA says you CAN animate morph targets, but doesn't specify WHICH ones or WHAT to name them.

---

## What We're Actually Doing

### Our Custom Approach

We created a **custom viseme system** based on common phoneme coverage:

```
Custom 11-Viseme Set:
- Vowels: A, I, U, E, O
- Consonants: F, M, S, CH, K, N
```

**This is NOT a standard** - it's our own implementation based on:
- Practical phoneme coverage
- Common blend shapes in character models
- Balance between quality and simplicity

### Why This Works

1. **VRMA is flexible**: Allows any morph target animation
2. **VRM models can have custom blend shapes**: Not limited to spec presets
3. **Our cleanup script creates these shapes**: We added them to the model
4. **Direct mesh access works**: We bypass VRM presets entirely

---

## Industry "Standards" (None Official for VRM)

### ARKit (Apple)
**52 blend shapes** for face tracking:

```
Jaw: jawOpen, jawForward, jawLeft, jawRight
Mouth: mouthClose, mouthFunnel, mouthPucker,
       mouthLeft, mouthRight, mouthSmileLeft,
       mouthSmileRight, mouthFrownLeft, mouthFrownRight,
       mouthDimpleLeft, mouthDimpleRight, etc.
Eyes: eyeBlinkLeft, eyeBlinkRight, eyeLookUpLeft, etc.
Brows: browDownLeft, browDownRight, browInnerUp, etc.
Cheeks: cheekPuff, cheekSquintLeft, etc.
```

**Status**: Apple standard, widely used in iOS apps, NOT part of VRM spec

### Oculus Visemes (Meta)
**15 visemes** for speech:

```
sil, PP, FF, TH, DD, kk, CH, SS, nn, RR, aa, E, ih, oh, ou
```

**Status**: Meta/Oculus standard for VR avatars, NOT part of VRM spec

### Mixamo/Adobe
**Basic visemes** (varies by model):

```
Typically: Ah, E, I, O, U, M, L, F, S
```

**Status**: Character-specific, NO universal standard

### Unity Humanoid
**No viseme standard** - Unity supports blend shapes but doesn't define naming

### Unreal Engine (MetaHuman)
**Extensive facial rig** with 100+ blend shapes

**Status**: Unreal-specific, NOT applicable to VRM

---

## The Problem: Fragmentation

Different ecosystems use different approaches:

| Platform | Blend Shapes | Naming | VRM Compatible |
|----------|--------------|--------|----------------|
| VRM Spec | 5-10 presets | a,i,u,e,o | ✓ (built-in) |
| ARKit | 52 shapes | mouthClose, etc. | ✗ (custom) |
| Oculus | 15 visemes | sil, PP, FF, etc. | ✗ (custom) |
| Our System | 11 visemes | A,I,U,E,O,F,M,S,CH,K,N | ✗ (custom) |
| Mixamo | ~9 visemes | Varies by model | ✗ (custom) |

**No interoperability!** Each system is incompatible with others.

---

## What SHOULD Be Standard (But Isn't)

### Ideal VRM Viseme Spec
If VRM were to standardize visemes, it might look like:

```
VRM Viseme Presets (proposed):
Vowels: aa, ee, ih, oh, uu
Bilabial: pp, bb, mm
Labiodental: ff, vv
Dental: th
Alveolar: tt, dd, ss, zz, nn, ll, rr
Palatal: sh, ch, yy
Velar: kk, gg
Glottal: hh
Special: sil (silence), schwa
```

**This would enable**:
- Universal lip-sync data exchange
- VRMA files that work across all VRM viewers
- Standard tooling for speech animation

**But it doesn't exist!**

---

## Current State of VRM Facial Animation

### What's Standardized
✓ Basic emotions (joy, angry, sad, fun, surprise)
✓ Vowels A,I,U,E,O (optional, basic)
✓ Blink/eye movement
✓ VRMA format supports morph target animation

### What's NOT Standardized
✗ Detailed visemes/phonemes
✗ Consonant mouth shapes
✗ Naming conventions for lip-sync
✗ How to map audio to blend shapes
✗ Intensity curves for co-articulation

---

## Our Approach: Valid But Custom

### What We Did

1. **Created custom blend shapes** on the VRM model
   - Named: A, I, U, E, O, F, M, S, CH, K, N
   - Not VRM spec presets (those are lowercase: a,i,u,e,o)
   - Not ARKit names (those are like mouthClose)
   - **Our own convention**

2. **Bypassed VRM BlendShapeProxy**
   - Accessed mesh.morphTargetDictionary directly
   - Works because three.js supports any morph target names
   - Independent of VRM spec

3. **Created custom VRMA format**
   - Could generate VRMA with our viseme names
   - Would work in our viewer
   - **Would NOT work in other VRM viewers** (they don't have our blend shapes)

### Is This Valid?

**Yes, it's valid because**:
- VRMA supports arbitrary morph target animations
- VRM models can have custom blend shapes beyond spec
- three.js renders any morph targets correctly

**But it's NOT standard because**:
- Not in VRM specification
- Not interoperable with other VRM systems
- Requires our specific model preparation

---

## Practical Recommendations

### For Interoperability
If you want your animations to work across VRM systems:

1. **Use VRM spec presets only**
   ```
   a, i, u, e, o (vowels)
   joy, angry, sad, fun (emotions)
   blink, blink_l, blink_r (eyes)
   ```

2. **Stick to BlendShapeProxy/ExpressionManager**
   - Don't use custom blend shapes
   - Limited to basic animations
   - Will work in all VRM viewers

### For Quality (Our Approach)
If you want high-quality lip-sync:

1. **Create custom viseme blend shapes**
   - Use ARKit names for iOS compatibility
   - Or use Oculus names for VR compatibility
   - Or use custom names (like ours) for full control

2. **Accept non-portability**
   - Your VRMA files only work with your models
   - Other VRM viewers won't have your blend shapes
   - Need to distribute model + animations together

### Hybrid Approach
**Best of both worlds**:

1. **Include VRM spec presets** (a,i,u,e,o)
   - Basic compatibility with all viewers
   - Accessible via BlendShapeProxy

2. **Add custom detailed visemes** (our 11-viseme set)
   - High-quality lip-sync when supported
   - Falls back to basic vowels if not

3. **In your viewer, try both**:
   ```javascript
   // Try BlendShapeProxy first (standard)
   if (vrm.expressionManager) {
       vrm.expressionManager.setValue('aa', value);
   }
   // Fall back to custom (high quality)
   else if (mesh.morphTargetDictionary['A']) {
       mesh.morphTargetInfluences[idx] = value;
   }
   ```

---

## The Future

### What VRM Needs
1. **Official viseme/phoneme preset specification**
2. **Standard naming convention** (adopt ARKit or Oculus or create new)
3. **VRMA validation** for facial animation compatibility
4. **Reference implementation** showing best practices

### Community Efforts
Some groups are working on standards:
- **VSeeFace**: Uses VRM + ARKit-like blend shapes
- **VRChat**: Custom avatar system with face tracking
- **V-Katsu**: Proprietary blend shapes
- **Warudo**: Supports ARKit blend shapes

**Still no universal standard!**

---

## Summary

### The Truth About VRM Facial Animation Standards

| Question | Answer |
|----------|--------|
| Is there a VRM viseme standard? | **NO** |
| Does VRMA support facial animation? | **YES** (generic morph targets) |
| Does VRMA specify viseme names? | **NO** |
| Are we following a standard? | **NO** (custom implementation) |
| Is our approach valid? | **YES** (VRMA allows custom morph targets) |
| Will our animations work elsewhere? | **NO** (models need our blend shapes) |
| Should VRM have a viseme standard? | **YES** (but it doesn't exist yet) |

### What We're Actually Doing

- **Using**: VRMA's generic morph target animation support
- **Creating**: Our own 11-viseme naming convention
- **Bypassing**: VRM BlendShapeProxy (limited presets)
- **Accessing**: Mesh morph targets directly via three.js
- **Result**: High-quality lip-sync that's NOT portable but works great

**Bottom line**: We're using VRMA's technical capabilities to create custom facial animations, but we're NOT following any official VRM standard because one doesn't exist for detailed visemes.

