# Running Animations with Visemes

## Overview

Visemes (facial morph targets) and skeletal animations (body movements) operate on different systems and can run simultaneously without interference.

### Key Concepts

**Morph Targets (Blend Shapes)**
- Modify vertex positions of meshes
- Used for facial expressions and visemes
- Independent of bone transformations
- Accessed via `mesh.morphTargetInfluences[]`

**Skeletal Animations**
- Modify bone rotations/positions
- Used for body movements (walking, jumping, waving)
- Managed by `THREE.AnimationMixer`
- Applied to the armature/skeleton

**Why They Don't Conflict**: Morph targets change vertex positions directly on the mesh, while skeletal animations transform bones. These are separate systems that update independently each frame.

---

## Implementation

### Basic Setup

```javascript
// In your A-Frame component:
init: function() {
    this.mixer = null;           // For skeletal animations
    this.currentAction = null;   // Current animation clip
    this.mesh = null;            // For viseme morph targets
}
```

### Loading Skeletal Animation

```javascript
onModelLoaded: function(evt) {
    this.vrm = evt.detail.vrm;
    this.mesh = this.findFaceMesh(this.vrm.scene);

    // Load animation from .vrma or .glb file
    const loader = new THREE.GLTFLoader();
    loader.load('animations/jump.vrma', (gltf) => {
        if (gltf.animations && gltf.animations.length > 0) {
            // Create mixer on the VRM's scene
            this.mixer = new THREE.AnimationMixer(this.vrm.scene);

            // Play the animation
            this.currentAction = this.mixer.clipAction(gltf.animations[0]);
            this.currentAction.setLoop(THREE.LoopRepeat);
            this.currentAction.play();
        }
    });
}
```

### Update Loop (Tick Function)

```javascript
tick: function(t, dt) {
    const deltaS = dt / 1000;

    // Update skeletal animation (bones)
    if (this.mixer) {
        this.mixer.update(deltaS);
    }

    // Update visemes (morph targets) - runs simultaneously
    const visemeValue = calculateVisemeValue(); // Your viseme logic
    this.applyViseme('A', visemeValue);
}
```

### Applying Visemes

```javascript
applyViseme: function(name, value) {
    if (this.mesh && this.mesh.morphTargetInfluences) {
        const idx = this.mesh.morphTargetDictionary[name];
        this.mesh.morphTargetInfluences[idx] = value;
    }
}
```

---

## Example Usage

### HTML Attribute
```html
<a-entity
    viseme-with-animation="
        vrm: models/character.vrm;
        animation: animations/jump.vrma;
        duration: 1.5
    ">
</a-entity>
```

### What Happens
1. VRM character loads
2. Skeletal animation (jump) loads and plays on loop
3. Visemes cycle through A, I, U, E, O, F, M, S, CH, K, N
4. Both systems update every frame independently
5. Character jumps while mouth moves for lip-sync

---

## Animation File Formats

### .vrma (VRM Animation)
- Specifically designed for VRM models
- Contains bone animations
- Compatible with three-vrm-animation library

### .glb / .gltf
- Standard 3D format
- Can contain animations
- Loaded via THREE.GLTFLoader
- Animation clips accessible via `gltf.animations[]`

### Where to Get Animations
- **Mixamo**: Free character animations (requires retargeting)
- **CMU Motion Capture Database**: Large collection of mocap data
- **Custom animations**: Created in Blender, Unity, etc.
- **Your project**: You have 2500+ CMU animations as .vrma files!

---

## Advanced: Multiple Animations

### Switching Between Animations
```javascript
switchAnimation: function(clipIndex) {
    if (!this.mixer || !this.animations) return;

    // Fade out current animation
    if (this.currentAction) {
        this.currentAction.fadeOut(0.5);
    }

    // Fade in new animation
    this.currentAction = this.mixer.clipAction(this.animations[clipIndex]);
    this.currentAction.reset().fadeIn(0.5).play();
}
```

### Blending Animations
```javascript
// Play multiple animations with different weights
const idleAction = this.mixer.clipAction(animations[0]);
const walkAction = this.mixer.clipAction(animations[1]);

idleAction.weight = 0.3;
walkAction.weight = 0.7;

idleAction.play();
walkAction.play();
```

### Animation Events
```javascript
this.mixer.addEventListener('finished', (e) => {
    console.log('Animation finished:', e.action.getClip().name);
    // Start next animation, loop, etc.
});
```

---

## Testing

### Verify Animations Load
```javascript
console.log('Animations in file:', gltf.animations.map(a => a.name));
console.log('Animation duration:', gltf.animations[0].duration);
```

### Check Morph Targets
```javascript
console.log('Morph targets:', Object.keys(mesh.morphTargetDictionary));
console.log('Current influences:', mesh.morphTargetInfluences);
```

### Debug Both Systems
```javascript
tick: function(t, dt) {
    console.log('Mixer time:', this.mixer ? this.mixer.time : 'none');
    console.log('Viseme value:', this.mesh.morphTargetInfluences[0]);
}
```

---

## Common Issues

### Issue: Animation doesn't play
**Solution**: Check that:
- `mixer.update(deltaTime)` is called every frame
- Animation clip is set to play: `action.play()`
- File contains valid animations: `gltf.animations.length > 0`

### Issue: Animation plays but visemes don't
**Solution**: Ensure visemes update in the same tick function:
```javascript
tick: function(t, dt) {
    if (this.mixer) this.mixer.update(dt/1000);  // Animation
    this.updateVisemes();                         // Visemes
}
```

### Issue: Visemes work but animation freezes
**Solution**: Make sure you're passing delta time correctly:
```javascript
// WRONG
this.mixer.update(t);  // Total time

// CORRECT
this.mixer.update(dt / 1000);  // Delta time in seconds
```

---

## Performance

### Optimization Tips

1. **Reuse AnimationMixer**: Create once, switch clips instead of recreating
2. **Limit Active Actions**: Stop unused animations to save CPU
3. **Use AnimationAction.timeScale**: Speed up/slow down instead of blending
4. **Simplify Animations**: Fewer keyframes = better performance
5. **LOD for Visemes**: Reduce morphTarget updates when far from camera

```javascript
// Example: Skip viseme updates when far away
const distance = this.el.object3D.position.distanceTo(camera.position);
if (distance < 5) {
    this.updateVisemes();  // Only update when close
}
```

---

## Example: Full Integration

See `visemes_with_animation.html` for a complete working example that demonstrates:
- Loading VRM character
- Loading skeletal animation from file
- Running visemes simultaneously
- UI feedback for both systems
- Error handling

To use:
1. Open `visemes_with_animation.html`
2. Add your animation file path to the `animation` attribute
3. Character will animate while visemes cycle through mouth shapes

---

## Resources

- **three.js Animation System**: https://threejs.org/docs/#manual/en/introduction/Animation-system
- **VRM Animation**: Included in your `three-vrm-animation.js`
- **A-Frame Animation**: https://aframe.io/docs/1.7.0/components/animation.html
- **Your CMU Animations**: Check your animations directory for 2500+ .vrma files

