/**
 * Stage.js - Manages the Scene, Lighting rig, and Camera behaviors
 */
export class Stage {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.engine = new BABYLON.Engine(this.canvas, true);
        this.scene = new BABYLON.Scene(this.engine);
        
        this.setupEnvironment();
        this.setupLights();
        this.setupCamera();
        
        window.addEventListener("resize", () => this.engine.resize());
    }

    setupEnvironment() {
        this.scene.ambientColor = new BABYLON.Color3(0.05, 0.05, 0.1);
        this.scene.clearColor = new BABYLON.Color4(0.04, 0.04, 0.08, 1);
    }

    setupLights() {
        this.keyLight = new BABYLON.DirectionalLight("key", new BABYLON.Vector3(0.3, -1, 0.5), this.scene);
        this.keyLight.intensity = 1.2;
        this.keyLight.diffuse = new BABYLON.Color3(1, 0.95, 0.85);

        this.fillLight = new BABYLON.HemisphericLight("fill", new BABYLON.Vector3(0, 1, 0), this.scene);
        this.fillLight.intensity = 0.35;
        this.fillLight.diffuse = new BABYLON.Color3(0.6, 0.7, 1);
        this.fillLight.groundColor = new BABYLON.Color3(0.05, 0.04, 0.08);
    }

    setupCamera() {
        this.camera = new BABYLON.ArcRotateCamera(
            "cam", 
            Math.PI / 2, 
            Math.PI / 2 - 0.22, 
            4.2, 
            new BABYLON.Vector3(0, 1.05, 0),
            this.scene
        );
        this.camera.attachControl(this.canvas, true);
        this.camera.lowerRadiusLimit = 1;
        this.camera.upperRadiusLimit = 12;
    }

    startRenderLoop() {
        this.engine.runRenderLoop(() => this.scene.render());
    }
}
