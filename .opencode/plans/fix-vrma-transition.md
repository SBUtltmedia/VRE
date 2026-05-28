# Fix VRMA transition not driving bones

## Status
- Phase 1 (Diagnose): **Pending**
- Phase 2 (Fix): **Pending**
- Phase 3 (Verify): **Pending**

---

## Phase 1 — Diagnose

### Problem
VRMA transition keyframes are generated correctly but the txGroup's values don't reach the bones — 110° per-frame delta with 300-frame transition proves the bones snap between idle/gesture rather than following txGroup's interpolated keyframes.

### Edit 1 — `plays/scene.html` ~line 509-512 (playEvent VRMA block)
After `txGroup.start(false, 1.0, 0, txSeconds, false);` add:

```js
txGroup._startTime = performance.now() / 1000;
actor._txGen = txGen;

// One-shot: log _activeAnimatables ordering for shared bones
if (!window.__diagLogged) {
  window.__diagLogged = true;
  const aa = scene._activeAnimatables || [];
  const txBoneNames = new Set(txGroup.targetedAnimations.map(ta => ta.target?.name).filter(Boolean));
  console.log(`[DIAG] _activeAnimatables count=${aa.length}`);
  for (let i = 0; i < aa.length; i++) {
    const a = aa[i];
    if (a.target?.name && txBoneNames.has(a.target.name)) {
      console.log(`[DIAG]   [${i}] ${a.target.name} anim="${a._animation?.name}" wt=${a.weight} loop=${a.loopAnimation}`);
    }
  }
  // Also log idle animatable weights for these bones
  for (const boneName of txBoneNames) {
    const idleAnims = aa.filter(a => a.target?.name === boneName && a._animation?.name?.includes('idle'));
    if (idleAnims.length) {
      idleAnims.forEach(a => console.log(`[DIAG]   IDLE ${boneName}: [${aa.indexOf(a)}] wt=${a.weight} loop=${a.loopAnimation}`));
    } else {
      console.log(`[DIAG]   IDLE ${boneName}: NOT FOUND in _activeAnimatables`);
    }
  }
}
```

### Edit 2 — `plays/scene.html` ~line 349 (render loop)
After `g.weight = 1;` inside `if (actor._usingVRMATransition)`:

```js
// ── DIAGNOSTIC: txGroup expected vs actual ──
if (actor._txGroup && actor._txGen) {
  window.__diagData ??= { frames: [], maxDiffs: {} };
  const diagTime = performance.now() / 1000;
  const elapsed = diagTime - (actor._txGroup._startTime || diagTime);
  const frame = elapsed * 60;
  for (const ta of actor._txGroup.targetedAnimations) {
    const bone = ta.target;
    if (!bone?.rotationQuaternion) continue;
    const keys = ta.animation.getKeys();
    if (!keys?.length) continue;
    const idx = Math.min(Math.round(frame), keys.length - 1);
    const expectedQ = keys[idx].value;
    const actualQ = bone.rotationQuaternion;
    const dot = BABYLON.Quaternion.Dot(expectedQ, actualQ);
    const deg = 2 * Math.acos(Math.min(1, Math.abs(dot))) * 57.2958;
    window.__diagData.maxDiffs[bone.name] = Math.max(window.__diagData.maxDiffs[bone.name] ?? 0, deg);

    if (deg > 1.0) {
      console.warn(`[DIAG] ${actor.id} ${bone.name} t=${elapsed.toFixed(3)}s f=${frame.toFixed(1)}/${keys.length-1}: diff=${deg.toFixed(1)}° exp=(${expectedQ.x.toFixed(3)},${expectedQ.y.toFixed(3)},${expectedQ.z.toFixed(3)},${expectedQ.w.toFixed(3)}) act=(${actualQ.x.toFixed(3)},${actualQ.y.toFixed(3)},${actualQ.z.toFixed(3)},${actualQ.w.toFixed(3)})`);
    }

    if (window.__diagData.frames.length < 3000) {
      window.__diagData.frames.push({
        t: elapsed, f: Math.round(frame), bone: bone.name, deg: +deg.toFixed(2),
        exp: expectedQ.clone(), act: actualQ.clone()
      });
    }
  }
}
```

### Edit 3 — `plays/scene.html` ~line 513 (timeout callback)
After `txGroup.dispose();` but before `actor._usingVRMATransition = false;`:

```js
// ── DIAGNOSTIC SUMMARY ──
const sortedBones = Object.entries(window.__diagData?.maxDiffs || {}).sort((a,b) => b[1]-a[1]);
console.log(`[DIAG] === Transition END === frames=${window.__diagData?.frames?.length || 0}`);
sortedBones.slice(0, 10).forEach(([name, deg]) => console.log(`[DIAG]   ${name}: max diff ${deg.toFixed(1)}°`));
```

---

## Phase 2 — Fix (onAfterAnimationsObservable override)

Once Phase 1 confirms the idle overwrites txGroup values, the fix follows InertializationBlend.js's architecture:

### In playEvent VRMA block (instead of current txGroup.start + timeout)

```js
// Start gesture group immediately (at entry frame, weight=0)
filtered.start(false, 1.0, entryFrame, filtered.to, false);
filtered.goToFrame(entryFrame);
filtered.weight = 0;
filtered._blendStartTime = performance.now() / 1000;
actor.gestureGroup = filtered;
actor._usingVRMATransition = true;
actor._txGroup = txGroup;

// Register onAfterAnimationsObservable to force-apply txGroup values
const afterAnimFn = () => {
  if (!actor._usingVRMATransition || !actor._txGroup) return;
  const elapsed = (performance.now() / 1000) - (actor._txGroup._startTime || 0);
  const t = Math.min(elapsed / TX_SECONDS, 1); // normalized 0→1
  const easeT = t < 0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;
  if (t >= 1) {
    // Transition complete: enable gesture, clean up
    filtered.weight = 1;
    txGroup.dispose();
    actor._txGroup = null;
    actor._usingVRMATransition = false;
    scene.onAfterAnimationsObservable.removeCallback(afterAnimFn);
    return;
  }
  // For each txGroup bone, slerp manually using eased t
  for (const ta of txGroup.targetedAnimations) {
    const bone = ta.target;
    if (!bone?.rotationQuaternion) continue;
    const keys = ta.animation.getKeys();
    if (!keys?.length) continue;
    const qStart = keys[0].value;
    const qEnd = keys[keys.length - 1].value;
    const blended = BABYLON.Quaternion.Slerp(qStart, qEnd, easeT);
    bone.rotationQuaternion.copyFrom(blended);
  }
};
scene.onAfterAnimationsObservable.add(afterAnimFn);

const TX_SECONDS = TX_FRAMES / 60;
txGroup._startTime = performance.now() / 1000;
txGroup.start(false, 1.0, 0, TX_SECONDS, false);
```

**Key change**: Instead of relying on txGroup's animatables to "win" in `_animate()`, we manually evaluate and force-apply via `onAfterAnimationsObservable` which fires after the entire animation pipeline. The txGroup is started only to advance its internal timer (animatables consume frames), but the actual bone values come from the observable callback.

NOTE: The idle continues to play normally — its animatables evaluate during `_animate()` and set bones to idle values. Then the observable fires and OVERRIDES upper body bones with txGroup values. This separation is what makes it work regardless of animatable evaluation order.

---

## Phase 3 — Verify

1. Run `node mjs_scripts/transition_iterative_diagnostic.mjs` with the fix
2. Compare violations across all 4 methods (weight, vrma, match, inertial)
3. Manual visual check: transition should be smooth with no snap
4. Run with TX_FRAMES=300 to confirm per-frame delta < 3°

---

## Rejected Alternatives

| Alternative | Why rejected |
|---|---|
| Stop idle during transition | Freezes lower body — acceptable for 0.25s but not ideal |
| Split idle into upper/lower | Complex — requires managing 2 animation groups for idle |
| Set idle weight=0 for upper body | Same as stopping — lower body still affected unless split |
| Use AnimationGroup.priority | Not available in Babylon.js UMD CDN (v9.x) |
