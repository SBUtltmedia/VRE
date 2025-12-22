# VRMA Lip-Sync Animation Standard

## Overview

VRMA files can contain **morph target animations** (blend shape keyframes) in addition to skeletal animations. This allows you to create "sentence" animations with timed mouth shapes, just like your mocap body animations.

## VRM Viseme Standards

### 1. VRM Specification (Official)

The VRM spec doesn't mandate specific viseme names, but common implementations use:

**VRM 0.x BlendShapeProxy Presets**:
- `a`, `i`, `u`, `e`, `o` - Basic vowels (lowercase in spec)
- Can have custom blend shapes for consonants

**VRM 1.0 Expressions**:
- More flexible naming
- Can define custom expression presets

### 2. Common Viseme Standards

#### Oculus Visemes (Meta/Facebook)
```
sil, PP, FF, TH, DD, kk, CH, SS, nn, RR, aa, E, ih, oh, ou
```
15 visemes covering all English phonemes

#### ARKit Visemes (Apple)
```
jawOpen, mouthClose, mouthFunnel, mouthPucker, mouthLeft, mouthRight,
mouthSmileLeft, mouthSmileRight, mouthFrownLeft, mouthFrownRight,
mouthDimpleLeft, mouthDimpleRight, mouthStretchLeft, mouthStretchRight,
mouthRollLower, mouthRollUpper, mouthShrugLower, mouthShrugUpper,
mouthPressLeft, mouthPressRight, mouthLowerDownLeft, mouthLowerDownRight,
mouthUpperUpLeft, mouthUpperUpRight
```
52 blend shapes (subset used for visemes)

#### Simplified Standard (Your Current Implementation)
```
A, I, U, E, O, F, M, S, CH, K, N
```
11 visemes - good balance of quality vs simplicity

#### JALI/Nvidia Standard
```
AA, AE, AH, AW, AY, EH, ER, EY, IH, IY, OW, OY, UH, UW,
B, CH, D, DH, F, G, HH, JH, K, L, M, N, NG, P, R, S, SH, T, TH, V, W, Y, Z, ZH
```
Phoneme-based approach (40+ shapes)

---

## VRMA File Structure with Lip-Sync

### Anatomy of a VRMA File

```json
{
  "animations": [
    {
      "name": "sentence_hello_world",
      "duration": 2.5,
      "tracks": [
        // Skeletal animations (body movement)
        {
          "type": "quaternion",
          "name": "Hips.quaternion",
          "times": [0, 0.5, 1.0, 1.5],
          "values": [...]
        },
        // Morph target animations (lip-sync)
        {
          "type": "number",
          "name": "H_DDS_HighRes.morphTargetInfluences[A]",
          "times": [0, 0.1, 0.2, 0.3],
          "values": [0, 1, 0.5, 0]
        },
        {
          "type": "number",
          "name": "H_DDS_HighRes.morphTargetInfluences[E]",
          "times": [0.3, 0.4, 0.5],
          "values": [0, 1, 0]
        }
      ]
    }
  ]
}
```

### Key Points

1. **Morph target tracks** are separate from bone tracks
2. Each viseme gets its own track with keyframe values (0.0 to 1.0)
3. Multiple visemes can be active simultaneously (blending)
4. Timing is in seconds from animation start

---

## Creating Lip-Sync VRMA Files

### Method 1: Manual in Blender

```python
import bpy

# Assuming you have a VRM imported
face_mesh = bpy.data.objects.get("H_DDS_HighRes")
action = bpy.data.actions.new("LipSync_Hello")

# Keyframe viseme 'A' at frame 0 and 10
face_mesh.data.shape_keys.key_blocks["A"].value = 1.0
face_mesh.data.shape_keys.key_blocks["A"].keyframe_insert("value", frame=0)
face_mesh.data.shape_keys.key_blocks["A"].value = 0.0
face_mesh.data.shape_keys.key_blocks["A"].keyframe_insert("value", frame=10)

# Export as VRMA using VRM addon
```

### Method 2: Programmatic Generation

```javascript
// Create VRMA-compatible animation data
function createLipSyncAnimation(phonemeTimings) {
    const tracks = [];

    phonemeTimings.forEach(({viseme, startTime, endTime, intensity}) => {
        const track = {
            type: 'number',
            name: `H_DDS_HighRes.morphTargetInfluences[${viseme}]`,
            times: [startTime, startTime + 0.05, endTime - 0.05, endTime],
            values: [0, intensity, intensity, 0]
        };
        tracks.push(track);
    });

    return {
        animations: [{
            name: 'generated_lipsync',
            duration: phonemeTimings[phonemeTimings.length - 1].endTime,
            tracks: tracks
        }]
    };
}

// Example usage
const sentence = [
    {viseme: 'A', startTime: 0.0, endTime: 0.2, intensity: 1.0},
    {viseme: 'E', startTime: 0.2, endTime: 0.4, intensity: 0.8},
    {viseme: 'I', startTime: 0.4, endTime: 0.6, intensity: 1.0}
];

const lipSyncData = createLipSyncAnimation(sentence);
```

### Method 3: Audio-to-Viseme Tools

**Rhubarb Lip Sync** (Open Source)
```bash
# Convert audio to viseme timing data
rhubarb -f json -o output.json input.wav

# Output format:
{
  "mouthCues": [
    {"start": 0.00, "end": 0.10, "value": "X"},  // Rest
    {"start": 0.10, "end": 0.25, "value": "A"},  // "ah"
    {"start": 0.25, "end": 0.40, "value": "B"}   // "b/m/p"
  ]
}
```

Then convert to VRMA format.

**Other Tools**:
- **Papagayo**: Open source lip-sync tool
- **Oculus Lip Sync**: Audio-driven viseme generation
- **SALSA Lip-Sync** (Unity): Real-time audio analysis
- **Wav2Lip**: AI-based (requires training)

---

## Loading Lip-Sync VRMA Files

### Enhanced A-Frame Component

```javascript
AFRAME.registerComponent('lipsync-player', {
    schema: {
        vrm: {type: 'string'},
        lipSyncFile: {type: 'string'} // Path to VRMA with lip-sync
    },

    init: function() {
        this.mixer = null;
        this.lipSyncAction = null;

        this.el.addEventListener('model-loaded', (evt) => {
            this.vrm = evt.detail.vrm;
            this.loadLipSync(this.data.lipSyncFile);
        });

        this.el.setAttribute('vrm', 'src', this.data.vrm);
    },

    loadLipSync: function(path) {
        const loader = new THREE.GLTFLoader();
        loader.load(path, (gltf) => {
            if (gltf.animations && gltf.animations.length > 0) {
                this.mixer = new THREE.AnimationMixer(this.vrm.scene);

                // This animation contains morph target tracks
                this.lipSyncAction = this.mixer.clipAction(gltf.animations[0]);
                this.lipSyncAction.play();

                console.log('Lip-sync animation loaded');
            }
        });
    },

    tick: function(t, dt) {
        if (this.mixer) {
            this.mixer.update(dt / 1000);
        }
    }
});
```

### Usage

```html
<a-entity
    lipsync-player="
        vrm: models/character.vrm;
        lipSyncFile: animations/sentence_hello.vrma
    ">
</a-entity>
```

**The mixer automatically applies morph target keyframes!** No manual `morphTargetInfluences` manipulation needed - three.js handles it.

---

## Text-to-Viseme Mapping

### Phoneme to Viseme Table

```javascript
const PHONEME_TO_VISEME = {
    // Vowels
    'AA': 'A',  'AE': 'A',  'AH': 'A',  'AO': 'O',  'AW': 'O',
    'AY': 'A',  'EH': 'E',  'ER': 'E',  'EY': 'E',  'IH': 'I',
    'IY': 'I',  'OW': 'O',  'OY': 'O',  'UH': 'U',  'UW': 'U',

    // Consonants
    'B': 'M',   'P': 'M',   'M': 'M',   // Lips closed
    'F': 'F',   'V': 'F',               // Lip-teeth
    'TH': 'S',  'DH': 'S',              // Tongue-teeth
    'S': 'S',   'Z': 'S',   'SH': 'CH', 'ZH': 'CH',
    'T': 'S',   'D': 'S',   'N': 'N',   'L': 'N',
    'K': 'K',   'G': 'K',   'NG': 'K',
    'CH': 'CH', 'JH': 'CH',
    'R': 'E',   'W': 'U',   'Y': 'I',   'HH': 'A',

    // Silence
    'SIL': 'neutral'
};
```

### Simple Text-to-Phoneme

For English, use a library like:
- **espeak**: Text-to-phoneme converter
- **CMU Pronouncing Dictionary**: Word-to-phoneme lookup
- **phonemizer**: Python library

```javascript
// Simplified example (real implementation needs proper TTS)
function textToVisemes(text) {
    const words = text.toLowerCase().split(' ');
    const visemes = [];
    let time = 0;

    words.forEach(word => {
        // Lookup phonemes for word (simplified)
        const phonemes = getPhonemes(word); // e.g., ["HH", "EH", "L", "OW"]

        phonemes.forEach(phoneme => {
            const viseme = PHONEME_TO_VISEME[phoneme];
            visemes.push({
                viseme: viseme,
                startTime: time,
                endTime: time + 0.1, // ~100ms per phoneme
                intensity: 1.0
            });
            time += 0.1;
        });

        // Add pause between words
        time += 0.2;
    });

    return visemes;
}
```

---

## Recommended Workflow

### For Pre-Recorded Speech

1. **Record audio** → WAV file
2. **Extract visemes** → Use Rhubarb Lip Sync
3. **Convert to VRMA** → Script to generate morph target tracks
4. **Load in A-Frame** → Use AnimationMixer

### For Real-Time Speech

1. **Audio input** → Microphone/TTS
2. **Real-time analysis** → Oculus Lip Sync or similar
3. **Direct morph target control** → Your current `applyViseme()` method
4. **No VRMA needed** → Live values applied per frame

### For Text-to-Speech

1. **Text input** → "Hello world"
2. **TTS → Audio** → Google TTS, Amazon Polly, etc.
3. **Audio → Visemes** → Rhubarb or audio analysis
4. **Generate VRMA** → Programmatically create animation
5. **Load and play** → AnimationMixer

---

## Standard Proposal for Your Project

Based on your current setup, I recommend:

### Viseme Names (Match your current implementation)
```
A, I, U, E, O, F, M, S, CH, K, N
```

### VRMA Structure
```javascript
{
  "animations": [{
    "name": "lipsync_[sentence_id]",
    "duration": [total_seconds],
    "tracks": [
      {
        "type": "number",
        "name": "H_DDS_HighRes.morphTargetInfluences[A]",
        "times": [...],
        "values": [...]
      },
      // ... one track per viseme used
    ]
  }]
}
```

### File Naming Convention
```
lipsync_hello_world.vrma
lipsync_how_are_you.vrma
lipsync_sentence_0001.vrma
```

---

## Next Steps

1. **Choose your source**: Audio files or text?
2. **Select tool**: Rhubarb (audio) or CMU Dict (text)?
3. **Create converter**: Script to generate VRMA from viseme timings
4. **Test with one sentence**: Verify the animation loads and plays
5. **Automate pipeline**: Batch process your speech library

Would you like me to create a script that converts Rhubarb output to VRMA format compatible with your current setup?

