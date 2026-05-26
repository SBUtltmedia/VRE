# Animation Pipeline Guide

End-to-end workflow for turning an audio file into an animated VRM character
in the Babylon.js scene. Covers:

1. The `scene*.json` manifest format that `A2FAvatar` consumes.
2. The two converter scripts that produce per-clip animation JSON:
   - `animations/csv_converter.py` — for **NVIDIA Audio2Face-3D** CSV output.
   - `animations/parse_a2e.py` — for **LAM Audio2Expression (A2E)** JSON output.
3. The end-to-end audio → character workflow.

---

## 1. How the runtime loads animations

The runtime entry point is [src/App.ts](src/App.ts). For each character it
constructs an `A2FAvatar` and calls `loadManifest(...)`:

```ts
const avatar = new A2FAvatar(scene);
await avatar.loadManifest('../scene3.json');

const secondCharacter = new A2FAvatar(scene);
await secondCharacter.loadManifest('../scene2.json');
```

Each manifest describes **one character** and the sequence of animation clips
it will play. Two avatars = two manifests. The path is fetched relative to the
served page (the Vite dev server serves `/scene/...` as the page root, so
`../scene3.json` resolves to the project-root `scene3.json`).

`A2FAvatar.loadManifest(...)` ([A2FAvatar.js:125](A2FAvatar.js)) does the
following:

1. `fetch`es the manifest JSON.
2. Merges `manifest.idle` into the avatar's idle config (blink/breathing).
3. Loads the VRM at `manifest.avatar` via the GLTF loader.
4. For each entry in `manifest.clips`, fetches the animation JSON (if any),
   notes the audio path (if any), and stores a `{animData, audioSrc, id,
   delayAfter}` clip object.
5. Drops into `IDLE` state. `playSequence()` / `playClip(i)` is called by the
   UI buttons defined in `App._createAvatarUI`.

---

## 2. Scene manifest schema (`scene.json`)

A scene file is a single JSON object with three top-level fields.

```json
{
  "avatar": "../models/Black/Black_F_1_Busi.vrm",
  "idle": {
    "blinkIntervalMin": 2.0,
    "blinkIntervalMax": 5.0,
    "blinkDuration": 0.15,
    "breathCycleSpeed": 0.4,
    "breathJawAmount": 0.05
  },
  "clips": [
    {
      "id": "recite_1",
      "animation": "animations/altaforte_frames.json",
      "audio": "audio/altaforte.wav",
      "delayAfter": 0
    }
  ]
}
```

### `avatar` (string, required)
URL of the `.vrm` file to load. Fetched via Babylon's GLTF loader with
`pluginExtension: ".glb"`. Path is resolved relative to the served page, the
same as the manifest itself.

### `idle` (object, optional)
Idle-state behaviour. All fields are optional; each key shown overrides
the matching default from `A2FAvatar` constructor defaults
([A2FAvatar.js:96-97](A2FAvatar.js)).

| Field              | Type   | Default | Meaning                                                  |
| ------------------ | ------ | ------- | -------------------------------------------------------- |
| `blinkIntervalMin` | number | 2.0     | Min seconds between blinks                               |
| `blinkIntervalMax` | number | 5.0     | Max seconds between blinks                               |
| `blinkDuration`    | number | 0.15    | Length of one blink (seconds, triangle in→out)           |
| `breathCycleSpeed` | number | 0.4     | Breathing frequency multiplier                           |
| `breathJawAmount`  | number | 0.012   | How far the jaw opens at peak inhale (morph weight 0–1)  |

### `clips` (array, required)
Played in array order by `avatar.playSequence()`. Each entry:

| Field         | Type             | Required | Meaning                                                                                                                |
| ------------- | ---------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `id`          | string           | yes      | Free-form name. Used for logging and `onClipStart`/`onClipEnd` callbacks.                                              |
| `animation`   | string \| null   | no       | URL of a converted animation JSON (the output of `csv_converter.py` or `parse_a2e.py`). `null` or `"N/A"` → no morphs. |
| `audio`       | string \| null   | no       | URL of the audio file (`.wav`, `.mp3`, …). `null` or `"N/A"` → silent.                                                 |
| `delayAfter`  | number           | no       | Seconds of idle between this clip and the next. Default `1.0`.                                                         |

**Three useful clip shapes**

- **Normal clip**: both `animation` and `audio` set. Playback is driven by
  `audio.currentTime` so morphs stay in sync with the audio.
  ([A2FAvatar.js:436](A2FAvatar.js))
- **Silent animation**: `animation` set, `audio: null`. Playback advances by
  real time (`dt`).
- **Pure delay (no-op)**: both `animation: null` and `audio: null`. The clip
  returns immediately, but `delayAfter` still applies — so this is how you
  schedule "do nothing for N seconds." Example from
  [scene3.json](scene3.json):

  ```json
  { "id": "wait_2", "animation": null, "audio": null, "delayAfter": 23 }
  ```

---

## 3. Per-clip animation JSON schema

Both converter scripts produce the same shape, which is what `A2FAvatar`
expects in `_tickPlaying` ([A2FAvatar.js:429](A2FAvatar.js)):

```json
{
  "fps": 30,
  "frameCount": 574,
  "blendShapeNames": ["eyeBlinkLeft", "eyeBlinkRight", "jawOpen", "..."],
  "frames": [
    { "time": 0.0,    "weights": [0.0, 0.0, 0.0, ...] },
    { "time": 0.0333, "weights": [0.12, 0.0, 0.05, ...] }
  ]
}
```

- `fps` — Sampling rate. The runtime picks a frame via
  `floor(playbackTime * fps)`.
- `frameCount` — Number of entries in `frames`. Must match `frames.length`.
- `blendShapeNames` — Ordered list of morph-target names. Each `frames[i].weights`
  is a flat array of the same length, in the same order.
- `frames[i].time` — Seconds from clip start. Currently informational; the
  runtime indexes by `fps` not by `time`.
- `frames[i].weights` — One float per name in `blendShapeNames`. Values are
  morph influences, typically 0–1.

### Morph-target naming

Names must match the VRM's morph-target names. The included `Black_F_1_Busi`
VRM uses ARKit-style **camelCase + `Left`/`Right`** suffixes:
`eyeBlinkLeft`, `mouthSmileRight`, `jawOpen`, `browInnerUp`, etc. Both
converters normalise to that convention.

A few names are also driven on the teeth meshes via the `TEETH_MAP` in
[A2FAvatar.js:16](A2FAvatar.js) (`jawOpen`, `mouthFunnel`, `mouthClose` →
matching morphs on `h_TeethDown` / `h_TeethUp`). You don't have to do anything
to enable that — it's automatic whenever those shapes appear in your
animation.

---

## 4. Converter A — Audio2Face-3D CSV → animation JSON

Script: [animations/csv_converter.py](animations/csv_converter.py).

### Input
The `animation_frames.csv` exported by NVIDIA Audio2Face-3D. The header row
names the columns; columns named `frame`, `time`, `timecode`, `time_code`,
`index`, or blank are treated as metadata and skipped — everything else is a
blendshape.

A2F outputs **PascalCase** names (e.g. `EyeBlinkLeft`); the script lower-cases
the first letter to produce `eyeBlinkLeft`. If a name contains a dot
(`Mesh.ShapeName`), the part after the dot is used.

### Command

```powershell
python animations\csv_converter.py <csv_file> [-o OUTPUT] [--fps FPS] [--precision N]
```

| Argument        | Required | Default                                | Meaning                                              |
| --------------- | -------- | -------------------------------------- | ---------------------------------------------------- |
| `csv_file`      | yes      | —                                      | Path to the Audio2Face CSV.                          |
| `-o`/`--output` | no       | Same basename, `.json` extension       | Output JSON path.                                    |
| `--fps`         | no       | `30`                                   | Playback FPS recorded into the output.               |
| `--precision`   | no       | `4`                                    | Decimal places for weights (keeps file size down).   |

### Examples

```powershell
# Simple: produces animations\altaforte_frames.json next to the CSV
python animations\csv_converter.py animations\altaforte_frames.csv

# Explicit output and 60 fps
python animations\csv_converter.py animations\altaforte_frames.csv `
  -o animations\altaforte_60fps.json --fps 60
```

The script prints frame/shape counts and the resulting duration on success.

---

## 5. Converter B — LAM Audio2Expression JSON → animation JSON

Script: [animations/parse_a2e.py](animations/parse_a2e.py).

### Input
LAM-A2E output JSON. Expected shape (see
[animations/lam_a2e_output.json](animations/lam_a2e_output.json) for an
example):

```json
{
  "names": [ "...52 ARKit-style names..." ],
  "metadata": { "fps": 30.0, "frame_count": 574, "blendshape_names": [...] },
  "frames": [
    { "time": 0.0, "weights": [ 52 floats ], "rotation": [] },
    ...
  ]
}
```

LAM-A2E names use the `_L`/`_R` ARKit convention (`eyeBlink_L`,
`mouthSmile_R`). The script converts these to the runtime's `Left`/`Right`
convention via `arkit_to_model_name`. The 52-shape order is hard-coded in
`LAM_A2E_SHAPES` and is used as the output `blendShapeNames`.

### Command

The script currently has **hard-coded paths and no CLI**. Out of the box:

```powershell
# Reads animations\lam_a2e_output.json, writes animations\model_animation.json
cd animations
python parse_a2e.py
```

To convert a different file, either:

- Rename your LAM output to `lam_a2e_output.json` before running, then rename
  `model_animation.json` afterwards; or
- Edit the bottom of `parse_a2e.py` ([animations/parse_a2e.py:53-60](animations/parse_a2e.py)):

  ```python
  with open("lam_a2e_output.json") as f:    # ← input path
      lam_data = json.load(f)
  result = convert_lam_to_model_format(lam_data)
  with open("model_animation.json", "w") as f:  # ← output path
      json.dump(result, f, indent=2)
  ```

The script also prints the ARKit-name → model-name mapping for every shape,
useful when diffing against a new VRM.

> **Note**: the converter assumes the LAM output's `frames[i].weights` array
> is already ordered to match `LAM_A2E_SHAPES`. The runtime does no name
> matching at playback — it indexes `weights[i]` against `blendShapeNames[i]`.
> If you suspect order drift, sanity-check by comparing
> `lam_data["names"]` / `metadata.blendshape_names` against `LAM_A2E_SHAPES`
> before trusting the output.

---

## 6. End-to-end workflow: audio file → animated character

1. **Pick a tool that turns audio into per-frame blendshape weights.**
   - NVIDIA Audio2Face-3D — produces a CSV.
   - LAM Audio2Expression — produces a JSON.

2. **Drop your input audio file** somewhere the dev server can serve it.
   Convention here is `audio/<name>.wav` at project root.

3. **Run the tool** on the audio file using its own CLI/UI to produce one of:
   - `animation_frames.csv` (Audio2Face-3D), or
   - `lam_a2e_output.json` (LAM-A2E).

4. **Convert to the runtime format.**

   For A2F-3D:
   ```powershell
   python animations\csv_converter.py path\to\animation_frames.csv `
     -o animations\my_clip_frames.json --fps 30
   ```

   For LAM-A2E (rename or edit the script paths first):
   ```powershell
   cd animations
   python parse_a2e.py
   # then rename model_animation.json → my_clip_frames.json
   ```

5. **Add a clip entry to your scene manifest.** Either edit
   [scene.json](scene.json) (or `scene2.json`, `scene3.json`) directly, or
   create a new manifest. Example:

   ```json
   {
     "id": "my_new_line",
     "animation": "animations/my_clip_frames.json",
     "audio": "audio/my_audio.wav",
     "delayAfter": 0.5
   }
   ```

6. **Point an avatar at the manifest** in [src/App.ts](src/App.ts):

   ```ts
   const avatar = new A2FAvatar(scene);
   await avatar.loadManifest('../my_scene.json');
   avatar.rootNode.position = new Vector3(x, y, z);
   avatar.rootNode.rotation = new Vector3(0, yaw, 0);
   avatar.rootNode.scaling  = new Vector3(175, 175, 175); // cm scene, m VRM
   ```

7. **Run the dev server and trigger playback.**

   ```powershell
   npm run dev
   ```

   The right-hand UI built in `App._createAvatarUI` has a **Play All** button
   (calls `playSequence()` on every avatar) and a **Stop** button
   (`stopAndReset()`).

### Path conventions used by the existing manifests

- VRMs live in `../models/<race>/...` (a sibling directory to the project).
- Converted animation JSONs live in `animations/`.
- Audio files live in `audio/`.
- Manifest URLs are resolved relative to the served page root (Vite serves
  `dist/scene` content, so `../scene3.json` walks up to the project root
  manifest).

If you put assets elsewhere, just update the strings in the manifest — they
are plain URLs that get `fetch`ed.
