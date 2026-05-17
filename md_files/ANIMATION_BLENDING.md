# Animation Blending and Layering

## The Problem: Conflicting Animations

When two animations affect the **same bones**, they conflict. By default, the last animation to update overwrites the first.

### Example Conflict

```javascript
// Both animate the legs!
const walkAction = mixer.clipAction(walkAnimation);
const runAction = mixer.clipAction(runAnimation);

walkAction.play();
runAction.play();

// Result: Only runAction visible (last update wins)
mixer.update(deltaTime);
```

### Non-Conflicting Animations

```javascript
// Lip-sync affects face morphTargets
const lipSyncAction = mixer.clipAction(lipSyncAnimation);

// Body mocap affects skeleton bones
const bodyAction = mixer.clipAction(bodyAnimation);

lipSyncAction.play();
bodyAction.play();

// Result: Both work perfectly! Different systems.
```

---

## Solutions

### Solution 1: Weight-Based Blending

Blend two animations by adjusting their influence weights:

```javascript
const walkAction = mixer.clipAction(walkAnimation);
const runAction = mixer.clipAction(runAnimation);

// Set weights (must sum to 1.0 for proper blending)
walkAction.weight = 0.7;  // 70% walk
runAction.weight = 0.3;   // 30% run

walkAction.play();
runAction.play();

// Result: Smooth blend between walking and running
```

### Solution 2: Crossfade Transitions

Smoothly transition from one animation to another:

```javascript
function crossfadeAnimations(fromAction, toAction, duration) {
    // Fade out current animation
    fromAction.fadeOut(duration);

    // Fade in new animation
    toAction.reset();
    toAction.fadeIn(duration);
    toAction.play();
}

// Usage:
crossfadeAnimations(walkAction, runAction, 0.5); // 0.5 second transition
```

### Solution 3: Animation Layers

Use different AnimationMixers for different body parts:

```javascript
// Upper body mixer
this.upperBodyMixer = new THREE.AnimationMixer(upperBodyRoot);
const waveAction = this.upperBodyMixer.clipAction(waveAnimation);

// Lower body mixer
this.lowerBodyMixer = new THREE.AnimationMixer(lowerBodyRoot);
const walkAction = this.lowerBodyMixer.clipAction(walkAnimation);

// Update both
tick: function(t, dt) {
    const deltaS = dt / 1000;
    this.upperBodyMixer.update(deltaS); // Arms waving
    this.lowerBodyMixer.update(deltaS);  // Legs walking
}
```

**Limitation**: Requires careful skeleton structure with separate root nodes.

### Solution 4: Sequential Playback

Play animations one after another:

```javascript
// Listen for animation completion
mixer.addEventListener('finished', (e) => {
    if (e.action === walkAction) {
        runAction.play();
    }
});

walkAction.setLoop(THREE.LoopOnce);
walkAction.play();
```

### Solution 5: Additive Animations

Layer animations on top of base pose:

```javascript
// Base animation (walk)
const walkAction = mixer.clipAction(walkAnimation);
walkAction.play();

// Additive animation (slight crouch)
const crouchAction = mixer.clipAction(crouchAnimation);
crouchAction.blendMode = THREE.AdditiveAnimationBlendMode;
crouchAction.play();

// Result: Walk + crouch = crouched walk
```

---

## Practical Examples

### Example 1: Lip-Sync + Body Movement

**Scenario**: Character walks while talking

```javascript
AFRAME.registerComponent('talking-walker', {
    init: function() {
        this.mixer = null;
        this.lipSyncAction = null;
        this.walkAction = null;

        this.el.addEventListener('model-loaded', (evt) => {
            this.vrm = evt.detail.vrm;
            this.mixer = new THREE.AnimationMixer(this.vrm.scene);

            // Load body animation
            this.loadAnimation('animations/walk.vrma', (clip) => {
                this.walkAction = this.mixer.clipAction(clip);
                this.walkAction.play();
            });

            // Load lip-sync animation
            this.loadAnimation('animations/sentence_hello.vrma', (clip) => {
                this.lipSyncAction = this.mixer.clipAction(clip);
                this.lipSyncAction.play();
            });
        });
    },

    loadAnimation: function(path, callback) {
        const loader = new THREE.GLTFLoader();
        loader.load(path, (gltf) => {
            if (gltf.animations && gltf.animations.length > 0) {
                callback(gltf.animations[0]);
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

**Result**: ✓ Works perfectly - lip-sync uses morph targets, walk uses bones.

---

### Example 2: Transitioning Between Leg Animations

**Scenario**: Smoothly transition from walk to run

```javascript
AFRAME.registerComponent('walk-run-blender', {
    schema: {
        speed: {type: 'number', default: 0.5} // 0=walk, 1=run
    },

    init: function() {
        this.mixer = null;
        this.walkAction = null;
        this.runAction = null;

        this.el.addEventListener('model-loaded', (evt) => {
            this.vrm = evt.detail.vrm;
            this.mixer = new THREE.AnimationMixer(this.vrm.scene);

            // Load both animations
            this.loadAnimations();
        });
    },

    loadAnimations: function() {
        const loader = new THREE.GLTFLoader();

        // Load walk
        loader.load('animations/walk.vrma', (gltf) => {
            this.walkAction = this.mixer.clipAction(gltf.animations[0]);
            this.walkAction.play();
        });

        // Load run
        loader.load('animations/run.vrma', (gltf) => {
            this.runAction = this.mixer.clipAction(gltf.animations[0]);
            this.runAction.play();
        });
    },

    update: function() {
        // Update weights based on speed
        if (this.walkAction && this.runAction) {
            const speed = this.data.speed;
            this.walkAction.weight = 1.0 - speed; // 1.0 at speed=0
            this.runAction.weight = speed;        // 1.0 at speed=1
        }
    },

    tick: function(t, dt) {
        if (this.mixer) {
            this.mixer.update(dt / 1000);
        }
    }
});
```

**Usage**:
```html
<!-- Walk only -->
<a-entity walk-run-blender="speed: 0"></a-entity>

<!-- 50% walk, 50% run -->
<a-entity walk-run-blender="speed: 0.5"></a-entity>

<!-- Run only -->
<a-entity walk-run-blender="speed: 1.0"></a-entity>
```

---

### Example 3: Upper Body + Lower Body

**Scenario**: Character waves while walking

```javascript
AFRAME.registerComponent('wave-while-walking', {
    init: function() {
        this.mixer = null;
        this.walkAction = null;
        this.waveAction = null;

        this.el.addEventListener('model-loaded', (evt) => {
            this.vrm = evt.detail.vrm;
            this.mixer = new THREE.AnimationMixer(this.vrm.scene);

            // Load walk (affects legs, hips, spine)
            this.loadAnimation('animations/walk.vrma', (clip) => {
                this.walkAction = this.mixer.clipAction(clip);
                this.walkAction.play();
            });

            // Load wave (affects arm, shoulder)
            this.loadAnimation('animations/wave.vrma', (clip) => {
                this.waveAction = this.mixer.clipAction(clip);

                // Filter: only affect upper body bones
                this.setupBoneFilter(this.waveAction, [
                    'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
                    'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand'
                ]);

                this.waveAction.play();
            });
        });
    },

    setupBoneFilter: function(action, allowedBones) {
        // This prevents the wave animation from affecting legs
        // Advanced: requires modifying animation tracks
        const clip = action.getClip();
        const filteredTracks = clip.tracks.filter(track => {
            return allowedBones.some(bone => track.name.includes(bone));
        });

        // Create new clip with filtered tracks
        const filteredClip = new THREE.AnimationClip(
            clip.name + '_filtered',
            clip.duration,
            filteredTracks
        );

        // Replace action with filtered version
        return this.mixer.clipAction(filteredClip);
    },

    loadAnimation: function(path, callback) {
        const loader = new THREE.GLTFLoader();
        loader.load(path, (gltf) => {
            if (gltf.animations && gltf.animations.length > 0) {
                callback(gltf.animations[0]);
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

**Result**: Legs walk, arms wave simultaneously.

---

### Example 4: Dynamic Speed Control

**Scenario**: Blend idle → walk → run based on movement speed

```javascript
AFRAME.registerComponent('speed-based-animation', {
    init: function() {
        this.mixer = null;
        this.idleAction = null;
        this.walkAction = null;
        this.runAction = null;
        this.currentSpeed = 0;

        this.el.addEventListener('model-loaded', (evt) => {
            this.vrm = evt.detail.vrm;
            this.mixer = new THREE.AnimationMixer(this.vrm.scene);
            this.loadAllAnimations();
        });
    },

    loadAllAnimations: function() {
        const loader = new THREE.GLTFLoader();

        loader.load('animations/idle.vrma', (gltf) => {
            this.idleAction = this.mixer.clipAction(gltf.animations[0]);
            this.idleAction.play();
        });

        loader.load('animations/walk.vrma', (gltf) => {
            this.walkAction = this.mixer.clipAction(gltf.animations[0]);
            this.walkAction.play();
        });

        loader.load('animations/run.vrma', (gltf) => {
            this.runAction = this.mixer.clipAction(gltf.animations[0]);
            this.runAction.play();
        });
    },

    setSpeed: function(speed) {
        this.currentSpeed = THREE.MathUtils.clamp(speed, 0, 2);
        this.updateWeights();
    },

    updateWeights: function() {
        if (!this.idleAction || !this.walkAction || !this.runAction) return;

        const speed = this.currentSpeed;

        if (speed < 1) {
            // Blend idle → walk
            this.idleAction.weight = 1.0 - speed;
            this.walkAction.weight = speed;
            this.runAction.weight = 0;
        } else {
            // Blend walk → run
            this.idleAction.weight = 0;
            this.walkAction.weight = 2.0 - speed;
            this.runAction.weight = speed - 1.0;
        }
    },

    tick: function(t, dt) {
        if (this.mixer) {
            // Example: calculate speed from movement
            // In real app, get from physics/controls
            const velocity = this.el.getAttribute('velocity') || {x:0, y:0, z:0};
            const speed = Math.sqrt(velocity.x**2 + velocity.z**2);
            this.setSpeed(speed);

            this.mixer.update(dt / 1000);
        }
    }
});
```

---

## Best Practices

### 1. Separate Systems = No Problem
- ✓ Lip-sync (morph targets) + Body animation (bones)
- ✓ Facial expressions + Full body mocap
- ✓ Eye tracking + Everything else

### 2. Same Bones = Need Strategy
- Use weight blending for smooth transitions
- Use crossfades for discrete transitions
- Use bone filtering for upper/lower body split
- Use animation layers (advanced)

### 3. Weight Management
```javascript
// BAD: Weights don't sum to 1.0
action1.weight = 0.5;
action2.weight = 0.5;
action3.weight = 0.5; // Result: too strong!

// GOOD: Weights sum to 1.0
action1.weight = 0.4;
action2.weight = 0.4;
action3.weight = 0.2; // Total = 1.0
```

### 4. Normalization
```javascript
// Auto-normalize weights
function normalizeWeights(actions) {
    const total = actions.reduce((sum, a) => sum + a.weight, 0);
    actions.forEach(a => a.weight /= total);
}
```

### 5. Performance
- ✓ Stop unused animations: `action.stop()`
- ✓ Disable actions not in use: `action.enabled = false`
- ✓ Use fewer active actions when possible
- ✗ Avoid 10+ simultaneous full-body animations

---

## Common Patterns

### Pattern 1: State Machine
```javascript
const states = {
    idle: idleAction,
    walk: walkAction,
    run: runAction,
    jump: jumpAction
};

function setState(newState) {
    const oldAction = states[currentState];
    const newAction = states[newState];

    oldAction.fadeOut(0.3);
    newAction.reset().fadeIn(0.3).play();

    currentState = newState;
}
```

### Pattern 2: Layered Actions
```javascript
// Base layer (always playing)
const baseAction = mixer.clipAction(idleAnimation);
baseAction.play();

// Additive layer (optional)
const emotionAction = mixer.clipAction(sadAnimation);
emotionAction.blendMode = THREE.AdditiveAnimationBlendMode;
emotionAction.play(); // Adds sadness to idle
```

### Pattern 3: One-Shot Actions
```javascript
// Play once, then return to idle
const punchAction = mixer.clipAction(punchAnimation);
punchAction.setLoop(THREE.LoopOnce);
punchAction.clampWhenFinished = true; // Hold last frame

mixer.addEventListener('finished', (e) => {
    if (e.action === punchAction) {
        setState('idle');
    }
});

punchAction.play();
```

---

## Summary

| Scenario | Solution | Code |
|----------|----------|------|
| Lip-sync + Body | Just load both | Different systems, no conflict |
| Walk → Run transition | Crossfade | `action.fadeOut()` / `fadeIn()` |
| Blend walk + run | Weights | `action.weight = 0.5` |
| Wave while walking | Bone filtering | Filter animation tracks |
| Idle/Walk/Run blend | Multi-weight | Normalize 3+ weights |
| Overlay emotion | Additive mode | `AdditiveAnimationBlendMode` |

**Key Takeaway**: Multiple VRMA files work together when they affect different parts (morph targets vs bones, or different bones). When they overlap, use weights, crossfades, or layers to blend them properly.

