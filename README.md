# VRE: VRM Runtime Engine & Animation Pipeline

A high-fidelity runtime environment and animation pipeline for VRM characters, focusing on expressive facial animation, cinematic playback, and standards-compliant assets.

## 🎬 Live Interactive Demos

Experience the latest builds directly in your browser (hosted on GitHub Pages):

*   **[Traffic Stop: MetaHuman Edition](https://tltmedia.github.io/VRE/plays/side_by_side_metahuman.html)** – Features VRM 1.0 MetaHuman models with full ArKit expression support and hybrid facial animation.
*   **[Side-by-Side Evaluation](https://tltmedia.github.io/VRE/plays/side_by_side_scene.html)** – A comparison tool for evaluating different VRM models within the same cinematic sequence.
*   **[BJS-VRM & CMU Mocap](https://tltmedia.github.io/VRE/babvrm.html)** – Demonstrates standard VRMA playback using high-quality mocap data from the CMU library.

---

## 🛠 Animation Pipeline

### Facial Animation (A2E / Audio2Face)
We utilize a hybrid animation system that prioritizes VRM 1.0 Expression Managers while falling back to direct morph target manipulation. This ensures full coverage for ArKit-derived shapes often missing from standard VRM presets.

*   [Facial Animation Standards](VRM_FACIAL_ANIMATION_STANDARDS.md) – *Stub: Standards for blendshape naming and mapping.*
*   [LipSync Mapping](RHUBARB_VISEME_MAPPING.md) – *Stub: Technical mapping between phonemes and VRM vowels.*

### Body Animation (VRMA / Mocap)
Our pipeline supports multi-layered VRMA files, allowing for independent control of Root, Body, and Face animation tracks.

*   [Animation Blending Guide](ANIMATION_BLENDING.md) – *Stub: Logic for combining multiple VRMA layers.*
*   [VRMA LipSync Standard](VRMA_LIPSYNC_STANDARD.md) – *Stub: Requirements for embedding lipsync in VRMA.*

---

## 🏗 Project Structure

- `/plays` – Interactive cinematic scenes and evaluation tools.
- `/models` – Optimized VRM 0.x and 1.0 character models.
- `/vrma` – Layered animation sequences.
- `/audio` – Source audio and lipsync JSON data.
- `/js` – Custom Babylon.js extensions and loaders.

---

## 🚀 Local Development

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/tltmedia/VRE.git
    cd VRE
    ```

2.  **Start the local server**:
    ```bash
    node serve.mjs
    ```

3.  **Access the workbench**:
    Open `http://localhost:3500` to view the diagnostic dashboard and scene list.

---

## 📋 Technical Documentation Stubs

- **[Model Preparation](docs/MODELS.md)** – Guidelines for converting GLB/FBM to optimized VRM.
- **[Scene Configuration](docs/SCENES.md)** – Documentation for the `traffic_scene.json` schema.
- **[Troubleshooting Rotation](docs/TRANSFORMS.md)** – Handling coordinate system discrepancies between Blender and Babylon.js.


