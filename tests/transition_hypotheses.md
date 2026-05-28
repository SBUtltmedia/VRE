# Transition Smoothness — Hypotheses Log

Log every hypothesis, the change made, the result, and why it was abandoned or accepted.
Prevents cycling through the same failed approaches.

## Active Hypothesis

### H1: Finger bones pollute transition metrics
- **Symptom**: Finger bones have 42–45° frame-to-frame deltas in idle VRMAs (111_22, 111_28). These inflate per-bone max-deg/frame metrics and make fade-to-steady ratios unreliable.
- **Change**: Filter `perBoneMaxDegPerFrame` and `computeTransitionMetrics` to limb bones only (exclude keys containing `thumb|index|middle|ring|little|metacarpal|finger` in `humanoidBone`).
- **Files**: `plays/scene.html`
- **Status**: Accepted — implemented 2026-05-27
- **Rationale**: Fingers are not visually significant for gesture-transition smoothness. Ignoring them gives a clean signal from limbs (spine, arms, legs).

### H2: Fade-out / return snap never measured
- **Symptom**: Test checks `fadeOutToSteadyRatio` and `returnSnapMaxDeg`, but `scene.html` never captures `fadeOutFrames` or computes these fields. Test passes despite visible snaps.
- **Change**: Add fade-out frame capture after gesture duration ends. Compute `fadeOutToSteadyRatio` (max deg/frame during fade-out vs steady) and `returnSnapMaxDeg` (max bone snap between last fade-out frame and first idle-only frame). Added general exit fade-out handler for ALL transition modes.
- **Files**: `plays/scene.html`
- **Status**: Accepted — implemented 2026-05-27
- **Rationale**: Without measuring the return to idle, the test is blind to the most visually jarring snap. The exit fade-out now runs uniformly via `_isStopping` flag regardless of transition mode.

### H3: Gesture exit fade-out missing for VRMA/inertial/match modes
- **Symptom**: In VRMA, inertial, and match modes, the render loop's weight handler only ran for `USE_WEIGHT_TRANSITION`. Setting `_isStopping` had no effect — gesture kept running at weight=1 during fade-out capture window.
- **Change**: Refactored render loop gesture handler. `_isStopping` is checked FIRST for all modes, ramping weight to 0 uniformly. Mode-specific entry transitions run only when NOT stopping.
- **Files**: `plays/scene.html` (line ~343)
- **Status**: Accepted — discovered during implementation 2026-05-27

### H4: Physical violation tracking too narrow
- **Symptom**: `TRACKED_BONES` was hardcoded to 6 bones (`spine, chest, upperChest, neck, leftUpperArm, rightUpperArm`). Limb bone snaps outside this set (legs, shoulders, hands) went undetected.
- **Change**: `TRACKED_BONES` now dynamically populated from `humanoidBone` entries, excluding finger bones. Falls back to original list if no actors loaded.
- **Files**: `plays/scene.html`
- **Status**: Accepted — implemented 2026-05-27

## Abandoned Hypotheses

### H5: Zeroing Hips translation keyframes is acceptable for gesture VRMAs
- **Symptom**: `fix_vrma_nodes.py` zeroed all translation keyframes (including Hips) because "the retargeter can't handle world-space translation in bone-local system." This destroyed root motion.
- **Change**: Changed `fix_vrma_nodes.py` to convert world-space translations to rest-relative deltas (`adjusted_k = keyframe_k - rest_translation`) instead of zeroing. For Hips: preserves 0.53m forward Z-motion. For other bones (constant rest offset → `[0,0,0]`): identical to previous zeroing.
- **Files**: `python_scripts/fix_vrma_nodes.py`
- **Status**: Replaced — implemented 2026-05-27
- **Rationale**: Zeroing translations was a hack that worked for the "stand still at rest position" case but broke any clip with motion. The correct world→local conversion (keyframe − rest_translation) preserves root motion while still being correct for the retargeter. All 350+ VRMAs have identity rest rotations, so the rotation conversion path (`conj(rest) × Q`) remains untriggered.

## Findings

- **All 350+ VRMAs** have identity rest rotations for every node. The rotation conversion code (`conj(rest) × Q`) in `fix_vrma_nodes.py` has never been activated. The Blender Z-up 90° X rotation artifact is applied by Babylon's VRMA loader at runtime, not stored in the file.
- **Only Hips** has animated (changing) translation keyframes. All other bones have constant translation = rest offset. Converting these to rest-relative deltas yields `[0,0,0]` for non-Hips bones.
- The Babylon-vrm-loader's `_retargetAnimationKeys` rotates translation deltas by the **target** bone's rest rotation. With rest-relative deltas from the fixed script, this should be correct — the target model's rest rotation defines the coordinate system for "forward," and the retargeter converts the delta into that space.
- **Remaining concern**: Source vs target rest rotation mismatch still needs the JavaScript-side fix (zeroing source TransformNode rotationQuaternion before retargeting), as documented in the Session 2026-05-24 model.html notes.
