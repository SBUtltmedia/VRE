/**
 * ChainTimeline.js - Sequential Animation Accumulator for Chaining Test
 * Each VRMA drives hips from its first to last keyframe. We capture the
 * hips local position at clip start and end, compute the delta, and
 * accumulate it into the VRM root position for seamless chaining.
 */
export class ChainTimeline {
    constructor(stage, actor) {
        this.stage = stage;
        this.actor = actor;
        this.currentIdx = 0;
        this.accumulatedPosition = new BABYLON.Vector3(0, 0, 0);
        this.accumulatedRotationY = 0;
    }

    resolveAsset(p) {
        return (p && !p.startsWith("http")) ? "../" + p : p;
    }

    async loadVRMA(url) {
        const scene = this.stage.scene;
        const managersBefore = new Set(scene.metadata?.vrmAnimationManagers ?? []);
        const container = await BABYLON.LoadAssetContainerAsync(this.resolveAsset(url), scene);
        const managersAfter = scene.metadata?.vrmAnimationManagers ?? [];
        const mgr = managersAfter.find(m => !managersBefore.has(m));
        const group = container.animationGroups[0];

        if (!mgr || !group) {
            container.dispose();
            return null;
        }

        const mapNodeNames = new Map();
        group.targetedAnimations.forEach((ta, i) => {
            const boneName = mgr.animationMap.get(i);
            const bone = this.actor.mgr.humanoidBone[boneName];
            if (bone && ta.target?.name) {
                mapNodeNames.set(ta.target.name, bone.name);
            }
        });

        const remapped = this.actor.vrmAvatar.retargetAnimationGroup(group, {
            animationGroupName: `chain-${url}`,
            fixRootPosition: false,
            rootNodeName: this.actor.mgr.humanoidBone["hips"]?.name,
            groundReferenceNodeName: this.actor.mgr.humanoidBone["leftFoot"]?.name,
            mapNodeNames,
        });

        container.dispose();
        return remapped;
    }

    _getHipsState() {
        const hips = this.actor.mgr.humanoidBone["hips"];
        if (!hips) return null;
        return {
            localPos: hips.position.clone(),
            localRotY: hips.rotationQuaternion ? hips.rotationQuaternion.toEulerAngles().y : 0,
        };
    }

    async playNext(sequence) {
        if (this.currentIdx >= sequence.length) {
            console.log("[Chain] Sequence complete.");
            document.body.setAttribute("data-status", "complete");
            document.body.removeAttribute("data-frame");
            return;
        }

        const step = sequence[this.currentIdx];
        console.log(`[Chain] Playing: ${step.name}`);
        document.body.setAttribute("data-current", step.name);
        document.body.setAttribute("data-status", "playing");

        // Stop and dispose previous clip
        if (this.actor.curGroups && this.actor.curGroups.length > 0) {
            this.actor.curGroups.forEach(g => { g.stop(); g.dispose(); });
            this.actor.curGroups = [];
        }

        // Apply accumulated transform to VRM root
        this.actor.root.position.copyFrom(this.accumulatedPosition);
        BABYLON.Quaternion.RotationYawPitchRollToRef(this.accumulatedRotationY, 0, 0, this.actor.root.rotationQuaternion);

        // Load new layers
        const bodyGroup = await this.loadVRMA(step.body);
        const rootGroup = await this.loadVRMA(step.root);

        if (!bodyGroup || !rootGroup) {
            console.error("[Chain] Failed to load animation layers.");
            return;
        }

        // Start at full weight (no fade-in for diagnostics)
        bodyGroup.start(false);
        rootGroup.start(false);
        this.actor.curGroups = [bodyGroup, rootGroup];

        // Wait one render frame for animation to drive the hips
        await new Promise(r => requestAnimationFrame(r));

        // Capture start position (animation's first keyframe in local space)
        const startState = this._getHipsState();
        console.log(`[Chain] Hips start: pos(${startState?.localPos.x.toFixed(3)}, ${startState?.localPos.y.toFixed(3)}, ${startState?.localPos.z.toFixed(3)}) rotY(${(startState?.localRotY * 57.3).toFixed(1)}°)`);

        document.body.setAttribute("data-frame", "start");

        // Compute duration (to/from are in frames at 60fps)
        const fps = 60;
        const duration = Math.max(
            (bodyGroup.to - bodyGroup.from) / (fps * (bodyGroup.speedRatio || 1)),
            (rootGroup.to - rootGroup.from) / (fps * (rootGroup.speedRatio || 1))
        );

        // Play the animation, rendering each frame
        const startTime = performance.now();
        const endTime = startTime + duration * 1000;

        while (performance.now() < endTime) {
            await new Promise(r => requestAnimationFrame(r));
        }

        // Capture end position BEFORE stopping (animation's last keyframe)
        const endState = this._getHipsState();

        if (startState && endState) {
            const deltaLocal = endState.localPos.subtract(startState.localPos);
            const deltaRotY = endState.localRotY - startState.localRotY;

            let normDeltaRotY = deltaRotY;
            while (normDeltaRotY < -Math.PI) normDeltaRotY += Math.PI * 2;
            while (normDeltaRotY > Math.PI) normDeltaRotY -= Math.PI * 2;

            // Transform local delta to world space using accumulated Y rotation
            const cosY = Math.cos(this.accumulatedRotationY);
            const sinY = Math.sin(this.accumulatedRotationY);
            const deltaWorldX = deltaLocal.x * cosY - deltaLocal.z * sinY;
            const deltaWorldZ = deltaLocal.x * sinY + deltaLocal.z * cosY;

            this.accumulatedPosition.x += deltaWorldX;
            this.accumulatedPosition.z += deltaWorldZ;
            this.accumulatedRotationY += normDeltaRotY;

            while (this.accumulatedRotationY < -Math.PI) this.accumulatedRotationY += Math.PI * 2;
            while (this.accumulatedRotationY > Math.PI) this.accumulatedRotationY -= Math.PI * 2;

            console.log(`[Chain] Hips end:   pos(${endState.localPos.x.toFixed(3)}, ${endState.localPos.y.toFixed(3)}, ${endState.localPos.z.toFixed(3)}) rotY(${(endState.localRotY * 57.3).toFixed(1)}°)`);
            console.log(`[Chain] Delta local: pos(${deltaLocal.x.toFixed(3)}, ${deltaLocal.z.toFixed(3)}) rotY(${(normDeltaRotY * 57.3).toFixed(1)}°)`);
            console.log(`[Chain] Delta world: pos(${deltaWorldX.toFixed(3)}, ${deltaWorldZ.toFixed(3)})`);
            console.log(`[Chain] Accumulated: pos(${this.accumulatedPosition.x.toFixed(3)}, ${this.accumulatedPosition.z.toFixed(3)}) rotY(${(this.accumulatedRotationY * 57.3).toFixed(1)}°)`);
        }

        // Apply accumulated transform to root so test can read final position
        this.actor.root.position.copyFrom(this.accumulatedPosition);
        BABYLON.Quaternion.RotationYawPitchRollToRef(this.accumulatedRotationY, 0, 0, this.actor.root.rotationQuaternion);

        // Stop animations
        bodyGroup.stop();
        rootGroup.stop();
        bodyGroup.dispose();
        rootGroup.dispose();
        this.actor.curGroups = [];

        document.body.setAttribute("data-frame", "end");

        this.currentIdx++;
        setTimeout(() => this.playNext(sequence), 30);
    }
}
