/**
 * ChainStage.js - Multi-viewport stage for diagnostic analysis
 */
export class ChainStage {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.engine = new BABYLON.Engine(this.canvas, true);
        this.scene = new BABYLON.Scene(this.engine);
        
        this.setupEnvironment();
        this.setupLights();
        this.setupCameras();
        
        window.addEventListener("resize", () => this.engine.resize());
    }

    setupEnvironment() {
        this.scene.ambientColor = new BABYLON.Color3(0.1, 0.1, 0.15);
        this.scene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.04, 1);
        
        // Add a grid for spatial reference
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

    setupCameras() {
        const target = new BABYLON.Vector3(0, 1, 0);

        // 1. Perspective (Top-Left)
        this.perspCam = new BABYLON.ArcRotateCamera("persp", Math.PI/4, Math.PI/3, 4, target, this.scene);
        this.perspCam.viewport = new BABYLON.Viewport(0, 0.5, 0.5, 0.5);

        // 2. Front (Top-Right)
        this.frontCam = new BABYLON.FreeCamera("front", new BABYLON.Vector3(0, 1, 4), this.scene);
        this.frontCam.setTarget(target);
        this.frontCam.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
        this.frontCam.viewport = new BABYLON.Viewport(0.5, 0.5, 0.5, 0.5);

        // 3. Side (Bottom-Left)
        this.sideCam = new BABYLON.FreeCamera("side", new BABYLON.Vector3(4, 1, 0), this.scene);
        this.sideCam.setTarget(target);
        this.sideCam.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
        this.sideCam.viewport = new BABYLON.Viewport(0, 0, 0.5, 0.5);

        // 4. Top (Bottom-Right)
        this.topCam = new BABYLON.FreeCamera("top", new BABYLON.Vector3(0, 6, 0), this.scene);
        this.topCam.setTarget(target);
        this.topCam.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
        this.topCam.viewport = new BABYLON.Viewport(0.5, 0, 0.5, 0.5);

        // Set Ortho size
        const dist = 1.5;
        [this.frontCam, this.sideCam, this.topCam].forEach(cam => {
            cam.orthoLeft = -dist;
            cam.orthoRight = dist;
            cam.orthoTop = dist;
            cam.orthoBottom = -dist;
        });

        this.scene.activeCameras.push(this.perspCam, this.frontCam, this.sideCam, this.topCam);
        this.perspCam.attachControl(this.canvas, true);
    }

    startRenderLoop() {
        this.engine.runRenderLoop(() => {
            // Synchronize ortho cameras to follow the perspective target if needed
            // For now, they stay centered on the origin or a relative offset
            this.scene.render();
        });
    }

    updateCameraTargets(target) {
        this.scene.activeCameras.forEach(cam => {
            if (cam.setTarget) cam.setTarget(target);
            else cam.target = target;
        });
    }
}
