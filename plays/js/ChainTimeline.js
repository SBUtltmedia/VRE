/**
 * ChainTimeline.js - Sequential Animation Accumulator for Chaining Test
 *
 * Plays VRMA clips sequentially using a single combined VRMA per step.
 * Retargets with fixRootPosition so Hips translation is proportion-correct.
 *
 * Approach:
 *   Position continuity is maintained by measuring the Hips-local snap error
 *   at clip boundaries and compensating root.position/rotation directly,
 *   avoiding any analytical derivation through the complex VRM hierarchy.
 */
export class ChainTimeline {
    constructor(stage, actor, config) {
        this.stage = stage;
        this.actor = actor;
        this.config = config || {};
        this.currentIdx = 0;
        this.accumulatedPosition = new BABYLON.Vector3(0, 0, 0);
        this.accumulatedRotationY = 0;
        this._cache = {};
    }

    resolveAsset(p) {
        return (p && !p.startsWith("http")) ? "../" + p : p;
    }

    async loadVRMA(url) {
        if (this._cache[url]) {
            return this._cache[url].clone(`chain-${url}-${this.currentIdx}`);
        }

        const scene = this.stage.scene;
        const managersBefore = (scene.metadata?.vrmAnimationManagers ?? []).length;
        const container = await BABYLON.LoadAssetContainerAsync(this.resolveAsset(url), scene);
        const vrmAnimMgr = (scene.metadata?.vrmAnimationManagers ?? [])[managersBefore];
        const group = container.animationGroups[0];

        if (!vrmAnimMgr?.animationMap || !group) {
            container.dispose();
            return null;
        }

        const mapNodeNames = new Map();
        group.targetedAnimations.forEach((ta, i) => {
            const boneName = vrmAnimMgr.animationMap.get(i);
            const bone = this.actor.mgr.humanoidBone[boneName];
            if (bone && ta.target?.name) {
                mapNodeNames.set(ta.target.name, bone.name);
            }
        });

        const remapped = this.actor.vrmAvatar.retargetAnimationGroup(group, {
            animationGroupName: `chain-${url}`,
            fixRootPosition: true,
            rootNodeName: this.actor.mgr.humanoidBone["hips"]?.name,
            groundReferenceNodeName: this.actor.mgr.humanoidBone["leftFoot"]?.name,
            mapNodeNames,
        });

        container.dispose();

        if (remapped) {
            this._cache[url] = remapped;
            return remapped.clone(`chain-${url}-${this.currentIdx}`);
        }
        return null;
    }

    _getHipsWorldPos() {
        const hips = this.actor.mgr.humanoidBone["hips"];
        if (!hips) return null;
        hips.computeWorldMatrix(true);
        return hips.getAbsolutePosition().clone();
    }

    _getHipsWorldRotationY() {
        const hips = this.actor.mgr.humanoidBone["hips"];
        if (!hips) return 0;
        const wm = hips.getWorldMatrix();
        const forward = new BABYLON.Vector3(wm.m[8], wm.m[9], wm.m[10]);
        return Math.atan2(forward.x, forward.z);
    }

    // Directly position root so Hips world matches accumulatedPosition.
    // Measures actual Hips world, computes error, and compensates linearly.
    // Uses iterative convergence because VRM intermediate transforms can cause
    // the correction to not fully take effect in a single pass.
    _alignRootToAccumulated() {
        this.actor.root.rotationQuaternion = null;
        const hips = this.actor.mgr.humanoidBone["hips"];
        if (!hips) return;

        for (let iter = 0; iter < 10; iter++) {
            this.actor.root.computeWorldMatrix(true);
            hips.computeWorldMatrix(true);

            const actualPos = hips.getAbsolutePosition();
            const dx = this.accumulatedPosition.x - actualPos.x;
            const dz = this.accumulatedPosition.z - actualPos.z;

            const actualRotY = this._getHipsWorldRotationY();
            let dRot = this.accumulatedRotationY - actualRotY;
            while (dRot < -Math.PI) dRot += Math.PI * 2;
            while (dRot > Math.PI) dRot -= Math.PI * 2;

            if (Math.abs(dx) < 1e-4 && Math.abs(dz) < 1e-4 && Math.abs(dRot) < 1e-4) break;

            this.actor.root.position.x += dx;
            this.actor.root.position.z += dz;
            this.actor.root.rotation.y += dRot;
        }

        this.actor.root.computeWorldMatrix(true);
    }

    _publishWorldPos() {
        const wp = this._getHipsWorldPos();
        if (wp) {
            const wrY = this._getHipsWorldRotationY();
            document.body.setAttribute("data-world-pos",
                `${wp.x.toFixed(3)},${wp.y.toFixed(3)},${wp.z.toFixed(3)},${wrY.toFixed(4)}`
            );
        }
    }

    _snapshotFrame(clipName, animGroup) {
        if (typeof window._chainData === 'undefined') return;
        const wp = this._getHipsWorldPos();
        if (!wp) return;
        const wrY = this._getHipsWorldRotationY();
        const totalFrames = this._playTo - this._playFrom;
        const curFrame = animGroup.animatables?.[0]?.masterFrame;
        const progress = (curFrame != null && totalFrames > 0)
            ? (curFrame - this._playFrom) / totalFrames
            : Math.min(this._animT / this._animDuration, 1);
        window._chainData.push({
            clip: clipName,
            progress: +(+progress.toFixed(4)),
            px: +wp.x.toFixed(4),
            pz: +wp.z.toFixed(4),
            ry: +(wrY * 57.3).toFixed(2),
        });
    }

    async playNext(sequence) {
        if (this.currentIdx >= sequence.length) {
            console.log("[Chain] Sequence complete.");
            await new Promise(r => setTimeout(r, 200));
            document.body.setAttribute("data-status", "complete");
            document.body.removeAttribute("data-frame");
            return;
        }

        const step = sequence[this.currentIdx];
        console.log(`[Chain] Playing: ${step.name}`);
        document.body.setAttribute("data-current", step.name);
        document.body.setAttribute("data-status", "playing");

        const animGroup = await this.loadVRMA(step.clip);
        if (!animGroup) {
            console.error("[Chain] Failed to load VRMA.");
            return;
        }

        const fps = 60;
        const playFrom = (step.from ?? animGroup.from);
        const playTo   = (step.to   ?? animGroup.to);
        const duration = (playTo - playFrom) / (fps * (animGroup.speedRatio || 1));
        this._playFrom = playFrom;
        this._playTo   = playTo;
        console.log(`[Chain] Range: ${playFrom}-${playTo} (${duration.toFixed(2)}s)`);
        document.body.setAttribute("data-duration", duration.toFixed(3));

        // Snapshot old bone transforms before new clip starts
        const oldBoneSnapshot = {};
        if (this.currentIdx > 0 && this.actor.curGroups?.length > 0) {
            for (const ta of animGroup.targetedAnimations) {
                const bone = ta.target;
                if (bone?.name) {
                    oldBoneSnapshot[bone.name] = {
                        pos: bone.position.clone(),
                        rot: bone.rotationQuaternion?.clone() ?? BABYLON.Quaternion.Identity(),
                        scale: bone.scaling.clone(),
                    };
                }
            }
        }

        this._animT = 0;
        this._animDuration = duration;
        const scene = this.stage.scene;
        const onRender = () => { this._animT += scene.deltaTime / 1000; };
        scene.onBeforeRenderObservable.add(onRender);

        if (this.currentIdx === 0) {
            this.accumulatedRotationY = this._getHipsWorldRotationY();
            this.accumulatedPosition.copyFrom(this._getHipsWorldPos());
        }

        animGroup.start(false);
        animGroup.goToFrame(playFrom);

        const hips = this.actor.mgr.humanoidBone["hips"];
        if (hips) hips.computeWorldMatrix(true);

        // Align root AFTER goToFrame, using the new clip's first-frame bone pose.
        // This absorbs the boundary mismatch between old-clip end and new-clip start
        // into the root.position, so the accumulator delta for this clip is pure
        // root motion (new_clip_local_final - new_clip_local_first).
        this._alignRootToAccumulated();

        // Dispose old groups NOW — the snapshot was captured and alignment is done.
        // The new group runs alone from here.
        if (this.actor.curGroups && this.actor.curGroups.length > 0) {
            this.actor.curGroups.forEach(g => { g.stop(); g.dispose(); });
        }
        this.actor.curGroups = [animGroup];

        // Log per-bone rotation deltas at boundary (diagnostic for stutter)
        if (this.currentIdx > 0 && Object.keys(oldBoneSnapshot).length > 0) {
            const seen = new Set();
            const deltas = [];
            for (const ta of animGroup.targetedAnimations) {
                const bone = ta.target;
                if (!bone?.name || seen.has(bone.name)) continue;
                seen.add(bone.name);
                const snap = oldBoneSnapshot[bone.name];
                if (!snap || !bone.rotationQuaternion) continue;
                const dot = BABYLON.Quaternion.Dot(snap.rot, bone.rotationQuaternion);
                const angle = 2 * Math.acos(Math.min(1, Math.abs(dot))) * 57.3;
                if (angle > 5) deltas.push({ bone: bone.name, deg: angle });
            }
            deltas.sort((a, b) => b.deg - a.deg);
            if (deltas.length > 0) {
                let line = `[Chain] Bone rotation deltas at ${step.name}:`;
                const top = deltas.slice(0, 5);
                for (const d of top) line += ` ${d.bone}=${d.deg.toFixed(1)}°`;
                if (deltas.length > 5) line += ` (+${deltas.length - 5} more)`;
                console.log(line);
            }
        }

        // Blend phase: manually crossfade each bone from old snapshot to new animation.
        // NO snapshot during blend — the interpolated body pose is non-deterministic.
        // Only the accumulator-controlled root path is tested via golden data, and that
        // converges to the accumulator by blend-end.
        const blendMs = this.currentIdx > 0
            ? (step.blend ?? this.config.defaultBlend ?? 200)
            : 0;
        const blendStart = blendMs > 0 ? performance.now() : 0;

        if (blendMs > 0) {
            const blendEnd = blendStart + blendMs;
            while (performance.now() < blendEnd) {
                await new Promise(r => requestAnimationFrame(r));
                const raw = Math.min((performance.now() - blendStart) / blendMs, 1);
                const t = raw * raw * (3 - 2 * raw); // smoothstep
                for (const ta of animGroup.targetedAnimations) {
                    const bone = ta.target;
                    if (!bone?.name) continue;
                    const snap = oldBoneSnapshot[bone.name];
                    if (!snap) continue;
                    bone.position = BABYLON.Vector3.Lerp(snap.pos, bone.position, t);
                    if (bone.rotationQuaternion) {
                        bone.rotationQuaternion = BABYLON.Quaternion.Slerp(snap.rot, bone.rotationQuaternion, t);
                    }
                    bone.scaling = BABYLON.Vector3.Lerp(snap.scale, bone.scaling, t);
                }
            }
        }

        const startWorldRotY = this._getHipsWorldRotationY();
        console.log(`[Chain] World start: pos(${this.accumulatedPosition.x.toFixed(3)}, ${this.accumulatedPosition.z.toFixed(3)}) rotY(${(startWorldRotY * 57.3).toFixed(1)}°)`);

        this._publishWorldPos();
        document.body.setAttribute("data-frame", "start");

        while (this._animT < this._animDuration) {
            await new Promise(r => requestAnimationFrame(r));
            this._snapshotFrame(step.name, animGroup);
        }

        scene.onBeforeRenderObservable.removeCallback(onRender);

        if (hips) hips.computeWorldMatrix(true);
        const endWorldPos = this._getHipsWorldPos();
        const endWorldRotY = this._getHipsWorldRotationY();

        const deltaWorldPos = endWorldPos.subtract(this.accumulatedPosition);
        let deltaRotY = endWorldRotY - startWorldRotY;
        while (deltaRotY < -Math.PI) deltaRotY += Math.PI * 2;
        while (deltaRotY > Math.PI) deltaRotY -= Math.PI * 2;

        this.accumulatedPosition.copyFrom(endWorldPos);
        this.accumulatedRotationY += deltaRotY;
        while (this.accumulatedRotationY < -Math.PI) this.accumulatedRotationY += Math.PI * 2;
        while (this.accumulatedRotationY > Math.PI) this.accumulatedRotationY -= Math.PI * 2;

        console.log(`[Chain] World end:   pos(${endWorldPos.x.toFixed(3)}, ${endWorldPos.z.toFixed(3)}) rotY(${(endWorldRotY * 57.3).toFixed(1)}°)`);
        console.log(`[Chain] Accumulated: pos(${this.accumulatedPosition.x.toFixed(3)}, ${this.accumulatedPosition.z.toFixed(3)}) rotY(${(this.accumulatedRotationY * 57.3).toFixed(1)}°)`);

        this._publishWorldPos();
        this._snapshotFrame(step.name, animGroup);
        document.body.setAttribute("data-frame", "end");
        this.currentIdx++;

        this.playNext(sequence);
    }
}
