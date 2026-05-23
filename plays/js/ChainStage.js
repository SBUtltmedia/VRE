/**
 * ChainStage.js - Single-camera stage with WASD controls
 */
export class ChainStage {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.engine = new BABYLON.Engine(this.canvas, true);
        this.scene = new BABYLON.Scene(this.engine);
        
        this.setupEnvironment();
        this.setupLights();
        this.setupCamera();
        this.setupKeyboard();
        
        window.addEventListener("resize", () => this.engine.resize());
    }

    setupEnvironment() {
        this.scene.ambientColor = new BABYLON.Color3(0.1, 0.1, 0.15);
        this.scene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.04, 1);
        
        const grid = BABYLON.MeshBuilder.CreateGround("grid", { width: 20, height: 20 }, this.scene);
        const gridMat = new BABYLON.StandardMaterial("gridMat", this.scene);
        gridMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        gridMat.specularColor = new BABYLON.Color3(0, 0, 0);
        gridMat.wireframe = true;
        grid.material = gridMat;
    }

    setupLights() {
        const key = new BABYLON.DirectionalLight("key", new BABYLON.Vector3(0.5, -1, 0.5), this.scene);
        key.intensity = 1.5;
        const fill = new BABYLON.HemisphericLight("fill", new BABYLON.Vector3(0, 1, 0), this.scene);
        fill.intensity = 0.5;
    }

    setupCamera() {
        this.camTarget = new BABYLON.Vector3(0, 1, 0);
        this.camera = new BABYLON.ArcRotateCamera("cam", Math.PI / 4, Math.PI / 3, 4, this.camTarget, this.scene);
        this.camera.attachControl(this.canvas, true);
        this.camera.lowerRadiusLimit = 0.5;
        this.camera.upperRadiusLimit = 20;
        this.camera.wheelPrecision = 50;
        this.camera.panningSensibility = 0;
        this.scene.activeCamera = this.camera;
    }

    setupKeyboard() {
        this.keys = { w: false, a: false, s: false, d: false, q: false, e: false };
        document.addEventListener("keydown", e => {
            const k = e.key.toLowerCase();
            if (k in this.keys) { this.keys[k] = true; e.preventDefault(); }
            if (k === "r") {
                this.camTarget.set(0, 1, 0);
                this.camera.setTarget(this.camTarget);
                this.camera.alpha = Math.PI / 4;
                this.camera.beta = Math.PI / 3;
                this.camera.radius = 4;
            }
        });
        document.addEventListener("keyup", e => {
            const k = e.key.toLowerCase();
            if (k in this.keys) { this.keys[k] = false; e.preventDefault(); }
        });
    }

    startRenderLoop() {
        this.engine.runRenderLoop(() => this.scene.render());
    }

    moveSpeed(dt) {
        const speed = 2.5;
        let dx = 0, dz = 0, dy = 0;
        if (this.keys.w) dz += speed;
        if (this.keys.s) dz -= speed;
        if (this.keys.a) dx -= speed;
        if (this.keys.d) dx += speed;
        if (this.keys.q) dy -= speed;
        if (this.keys.e) dy += speed;
        if (dx !== 0 || dz !== 0 || dy !== 0) {
            const fwd = this.camera.getDirection(new BABYLON.Vector3(0, 0, 1));
            const right = this.camera.getDirection(new BABYLON.Vector3(1, 0, 0));
            fwd.y = 0; fwd.normalize();
            right.y = 0; right.normalize();
            this.camTarget.x += (fwd.x * dz + right.x * dx) * dt;
            this.camTarget.z += (fwd.z * dz + right.z * dx) * dt;
            this.camTarget.y += dy * dt;
            this.camera.setTarget(this.camTarget);
        }
    }
}
