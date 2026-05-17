# Rhubarb Viseme Mapping

## Rhubarb Mouth Cues

Rhubarb Lip Sync uses 9 mouth shapes (A-H + X):

| Cue | Description | Example Sounds |
|-----|-------------|----------------|
| **X** | Rest position | Silence, closed mouth |
| **A** | Open mouth | "father", "car" (AH) |
| **B** | Lips together | "mat", "bat", "pat" (M, B, P) |
| **C** | Rounded mouth | "boat", "soon" (O, U) |
| **D** | Wide mouth | "eat", "week" (E, I) |
| **E** | Relaxed/neutral | "about", "father" (schwa, ER) |
| **F** | Upper teeth on lower lip | "fox", "very" (F, V) |
| **G** | Back of tongue raised | "cat", "got" (K, G) |
| **H** | Tongue tip up | "lion", "red", "sit" (L, R, S) |

## Our VRM Viseme System

We use 11 visemes:

| Viseme | Type | Description |
|--------|------|-------------|
| **A** | Vowel | Open mouth (AH sound) |
| **I** | Vowel | Wide smile (EE sound) |
| **U** | Vowel | Rounded lips (OO sound) |
| **E** | Vowel | Slightly open (EH sound) |
| **O** | Vowel | Rounded open (OH sound) |
| **F** | Consonant | Teeth on lip (F, V) |
| **M** | Consonant | Lips together (M, B, P) |
| **S** | Consonant | Tongue tip (S, Z, T, D) |
| **CH** | Consonant | Lips forward (SH, CH) |
| **K** | Consonant | Back tongue (K, G) |
| **N** | Consonant | Tongue tip (N, L, R) |

## Mapping: Rhubarb → Our System

```javascript
const RHUBARB_TO_VISEME = {
    'X': null,        // Rest position (all visemes at 0)
    'A': 'A',         // Open mouth → A
    'B': 'M',         // Lips together → M
    'C': 'O',         // Rounded mouth → O
    'D': 'E',         // Wide mouth → E (could also use I)
    'E': 'E',         // Relaxed mouth → E
    'F': 'F',         // Teeth on lip → F
    'G': 'K',         // Back tongue → K
    'H': 'S'          // Tongue tip → S (could also use N)
};
```

### Mapping Rationale

**Direct Mappings** (perfect match):
- F → F: Both are teeth-on-lip sounds
- B → M: Both are lips-together sounds
- G → K: Both are back-of-tongue sounds
- A → A: Both are open mouth vowels

**Compromise Mappings**:
- **C → O**: Rhubarb's C covers both O and U. We chose O as primary.
  - Alternative: Could blend O and U for better accuracy
- **D → E**: Rhubarb's D covers both E and I (wide mouth). We chose E.
  - Alternative: Could use I for more smile
- **H → S**: Rhubarb's H covers L, R, S. We chose S as most visible.
  - Alternative: Could use N for L/R sounds
- **E → E**: Rhubarb's E (relaxed) maps well to our E

**Special Case**:
- **X → null**: Rest position means all visemes = 0

### Limitations

1. **Merged Sounds**: Rhubarb combines multiple sounds into single cues
   - C covers O and U (we only use O)
   - D covers E and I (we only use E)
   - H covers L, R, and S (we only use S)

2. **Missing Visemes**: Some of our visemes are unused
   - **I**: Would be better for "EE" sounds (covered by D/E)
   - **U**: Would be better for "OO" sounds (covered by C/O)
   - **CH**: Not directly mapped (Rhubarb uses H for similar sounds)
   - **N**: Not directly mapped (Rhubarb uses H for tongue-tip sounds)

3. **No Blending**: Currently one viseme at a time
   - Could improve by blending adjacent sounds
   - Example: C could trigger both O (0.7) + U (0.3)

## Improving the Mapping

### Option 1: Blend Multiple Visemes

```javascript
const RHUBARB_TO_VISEME_ADVANCED = {
    'X': [],
    'A': [{viseme: 'A', weight: 1.0}],
    'B': [{viseme: 'M', weight: 1.0}],
    'C': [{viseme: 'O', weight: 0.7}, {viseme: 'U', weight: 0.3}],
    'D': [{viseme: 'I', weight: 0.6}, {viseme: 'E', weight: 0.4}],
    'E': [{viseme: 'E', weight: 1.0}],
    'F': [{viseme: 'F', weight: 1.0}],
    'G': [{viseme: 'K', weight: 1.0}],
    'H': [{viseme: 'S', weight: 0.5}, {viseme: 'N', weight: 0.5}]
};
```

### Option 2: Context-Aware Mapping

Use the audio frequency analysis to refine the mapping:
- High frequencies → Use S
- Low rounded → Use O
- Low spread → Use E

### Option 3: Manual Refinement

For hero shots:
1. Use Rhubarb as initial pass
2. Import JSON into Blender
3. Manually adjust visemes in timeline
4. Export refined VRMA

## Example: "Houston, we have a problem"

Rhubarb output:
```
H(0.03-0.24) → F
E(0.24-0.30) → E
C(0.30-0.55) → O
B(0.55-0.77) → M
...
```

Our mapping produces:
```
F(0.03-0.24) → F viseme
E(0.24-0.30) → E viseme
O(0.30-0.55) → O viseme
M(0.55-0.77) → M viseme
...
```

Phonetically:
- "H" (silent) + "oo" = F+O ✓
- "s" = (covered by previous)
- "t" = O (rounded)
- "ən" = M (lips together for N)
- "we" = F+M+O
- "have" = O+A
- "a" = M+A
- "problem" = A+H+M

## Performance Notes

- Single viseme per frame: **Fast** (current implementation)
- Blended visemes: **Medium** (2-3 visemes active)
- Context-aware: **Slower** (requires audio analysis)

## Testing

Open `speech.html` and press Play to see the mapping in action:
- Green text shows: `Rhubarb Cue → Our Viseme : Intensity`
- Example: `F → F : 0.87` (Rhubarb F maps to our F at 87% intensity)

