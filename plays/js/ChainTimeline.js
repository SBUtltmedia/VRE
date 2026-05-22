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
    constructor(stage, actor) {
        this.stage = stage;
        this.actor = actor;
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

        // Initialize state for this clip
        animGroup.start(false);
        animGroup.goToFrame(animGroup.from);

        const hips = this.actor.mgr.humanoidBone["hips"];
        if (hips) hips.computeWorldMatrix(true);

        // FIRST clip: initialize accumulated state from character's base pose
        if (this.currentIdx === 0) {
            this.accumulatedRotationY = this._getHipsWorldRotationY();
            this.accumulatedPosition.copyFrom(this._getHipsWorldPos());
        }

        // Align root so Hips world matches accumulatedPosition.
        // For clip 0 the root is at identity and accumulatedPosition
        // already matched; _alignRootToAccumulated corrects any drift.
        // For subsequent clips, Hips local snapped from end-of-prev to
        // start-of-this and root compensation happens here.
        this._alignRootToAccumulated();

        // Dispose previous groups ONLY after alignment
        if (this.actor.curGroups && this.actor.curGroups.length > 0) {
            this.actor.curGroups.forEach(g => { g.stop(); g.dispose(); });
        }
        this.actor.curGroups = [animGroup];

        const startWorldRotY = this._getHipsWorldRotationY();
        console.log(`[Chain] World start: pos(${this.accumulatedPosition.x.toFixed(3)}, ${this.accumulatedPosition.z.toFixed(3)}) rotY(${(startWorldRotY * 57.3).toFixed(1)}°)`);

        this._publishWorldPos();
        document.body.setAttribute("data-frame", "start");

        const fps = 60;
        const duration = (animGroup.to - animGroup.from) / (fps * (animGroup.speedRatio || 1));
        document.body.setAttribute("data-duration", duration.toFixed(3));

        const startTime = performance.now();
        const endTime = startTime + duration * 1000;

        while (performance.now() < endTime) {
            await new Promise(r => requestAnimationFrame(r));
        }

        // Capture end state
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
        document.body.setAttribute("data-frame", "end");
        this.currentIdx++;

        // Wait for test poll to capture the "end" state before transitioning
        await new Promise(r => setTimeout(r, 200));
        this.playNext(sequence);
    }
}
