import { Scene } from "@babylonjs/core/scene";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Vector3, Quaternion } from "@babylonjs/core/Maths/math.vector";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { ImportMeshAsync } from "@babylonjs/core/Loading/sceneLoader";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { WebXRState } from "@babylonjs/core/XR/webXRTypes";

import HavokPhysics from "@babylonjs/havok";

import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Loading/Plugins/babylonFileLoader";

import "@babylonjs/core/Cameras/universalCamera";

import "@babylonjs/core/Meshes/groundMesh";

import "@babylonjs/core/Lights/directionalLight";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";

import "@babylonjs/core/Materials/PBR/pbrMaterial";
import "@babylonjs/core/Materials/standardMaterial";
import "@babylonjs/core/XR/features/WebXRDepthSensing";
import { WebXRDefaultExperience } from "@babylonjs/core/XR/webXRDefaultExperience";

import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import "@babylonjs/core/Rendering/prePassRendererSceneComponent";

import "@babylonjs/core/Materials/Textures/Loaders/envTextureLoader";

import "@babylonjs/core/Physics";

import "@babylonjs/materials/sky";

import "@babylonjs/loaders/glTF";

// Set up minimal BABYLON global — A2FAvatar.js uses BABYLON.ImportMeshAsync
// and checks BABYLON.VRMFileLoader
(window as any).BABYLON = {
	...(window as any).BABYLON,
	ImportMeshAsync,
	SceneLoader,
	Quaternion,
	Vector3,
};

// @ts-ignore
import { A2FAvatar } from '../A2FAvatar.js';

export class App {
	public canvas: HTMLCanvasElement;
	public engine: Engine | null = null;
	public scene: Scene | null = null;
	private keys = new Map<string, boolean>();
	private mouseMovement = { x: 0, y: 0 };
	private yaw = 0;   // Horizontal rotation (left/right)
	private pitch = 0; // Vertical rotation (up/down)

	constructor() {
		const canvasElement = document.getElementById('canvas') as HTMLCanvasElement;
		if (!canvasElement) {
			throw new Error('Canvas element not found');
		}
		this.canvas = canvasElement;

		// Track keyboard input
		window.addEventListener('keydown', (e) => this.keys.set(e.key.toLowerCase(), true));
		window.addEventListener('keyup', (e) => this.keys.set(e.key.toLowerCase(), false));

		// Track mouse delta for head rotation (relative movement only)
		window.addEventListener('mousemove', (e) => {
			this.mouseMovement.x = e.movementX;
			this.mouseMovement.y = e.movementY;
		});

		// Lock pointer on click for rotation control
		this.canvas.addEventListener('click', () => {
			this.canvas.requestPointerLock = (this.canvas as any).requestPointerLock || (this.canvas as any).mozRequestPointerLock;
			this.canvas.requestPointerLock();
		});

		// Unlock pointer on ESC
		document.addEventListener('pointerlockchange', () => {
			if (!document.pointerLockElement) {
				console.log('[App] Pointer unlocked. Click canvas to look around again.');
			}
		});
	}

	public async init(): Promise<void> {
		this.engine = new Engine(this.canvas, true, {
			stencil: true,
			antialias: true,
			audioEngine: true,
			adaptToDeviceRatio: true,
			disableWebGL2Support: false,
			useHighPrecisionFloats: true,
			powerPreference: "high-performance",
			failIfMajorPerformanceCaveat: false,
		});

		this.scene = new Scene(this.engine);

		await this._handleLoad();

		// Handle window resize
		window.addEventListener("resize", () => {
			this.engine?.resize();
		});

		// Start render loop
		this.engine.runRenderLoop(() => {
			//console.log(this.scene?.activeCamera?.position);
			this.scene?.render();
		});
	}

	private async _handleLoad(): Promise<void> {
		if (!this.engine || !this.scene) { return; }

		console.log('[App] Starting _handleLoad...');

		let avatar: any;
		let secondCharacter: any;

		try {
			console.log('[App] Initializing Havok physics...');
			const havok = await HavokPhysics();
			this.scene.enablePhysics(new Vector3(0, -981, 0), new HavokPlugin(true, havok));
			console.log('[App] Physics enabled');
		} catch (e) {
			console.error('[App] Physics init failed:', e);
			return;
		}

		try {
			console.log('[App] Loading babylon scene...');
			SceneLoader.ForceFullSceneLoadingForIncremental = true;
			await SceneLoader.AppendAsync("/scene/", "example.babylon", this.scene);
			await this.scene.whenReadyAsync();
			console.log('[App] Scene loaded');
		} catch (e) {
			console.error('[App] Scene load failed:', e);
			return;
		}

		try {
			console.log('[App] Attaching camera controls...');
			if (this.scene.activeCamera) {
				this.scene.activeCamera.attachControl();
			}
			console.log('[App] Camera ready');
		} catch (e) {
			console.error('[App] Camera setup failed:', e);
		}

		try {
			console.log('[App] Loading avatars...');
			avatar = new A2FAvatar(this.scene);
			await avatar.loadManifest('../scene.json');

			secondCharacter = new A2FAvatar(this.scene);
			await secondCharacter.loadManifest('../scene2.json');

			console.log('[App] Avatar loaded. rootNode:', avatar.rootNode?.name,
				'faceMesh:', avatar.faceMesh?.name, 'clips:', avatar.clips.length);

			if (avatar.rootNode) {
				avatar.rootNode.position = new Vector3(5000, 5.5, -400);
				avatar.rootNode.rotation = new Vector3(0, -4 * Math.PI / 3, 0);
				avatar.rootNode.scaling = new Vector3(175, 175, 175);
			}

			if (secondCharacter.rootNode) {
				secondCharacter.rootNode.position = new Vector3(5300, 5.5, -600);
				secondCharacter.rootNode.rotation = new Vector3(0, -1 * Math.PI / 3, 0);
				secondCharacter.rootNode.scaling = new Vector3(175, 175, 175);
			}

			const findBoneIn = (root: any, name: string) => {
				const descendants = root.getDescendants(false);
				return descendants.find((t: any) => t.name === name)
					?? descendants.find((t: any) => t.name.toLowerCase().includes(name.toLowerCase()));
			};
			const armDown = (75 * Math.PI) / 180;
			for (const root of [avatar.rootNode, secondCharacter.rootNode]) {
				if (!root) continue;
				const leftArm  = findBoneIn(root, 'LeftArm');
				const rightArm = findBoneIn(root, 'RightArm');
				if (leftArm)  leftArm.rotationQuaternion  = Quaternion.RotationAxis(new Vector3(1, 0, 0), -armDown);
				if (rightArm) rightArm.rotationQuaternion = Quaternion.RotationAxis(new Vector3(1, 0, 0), -armDown);
			}
			console.log('[App] Avatars configured');
		} catch (e) {
			console.error('[App] Avatar setup failed:', e);
		}

		console.log('[App] Initializing WebXR...');
		try {
			const xrHelper = await WebXRDefaultExperience.CreateAsync(this.scene);
			console.log('[App] WebXR CreateAsync returned');
			
			if (xrHelper) {
				console.log('[App] WebXR ready — Controls: WASD=move, Space/Ctrl=up/down, Mouse=look around (Click to lock)');
				
				const xrCamera = xrHelper.baseExperience.camera;
				const speed = 500;
				let lastFrameTime = performance.now();
				let isXRActive = false;

				console.log('[App] Adding XR state observer...');
				xrHelper.baseExperience.onStateChangedObservable.add((state) => {
					console.log('[App] XR state changed:', state);
					isXRActive = state === WebXRState.IN_XR;
					if (isXRActive) {
						console.log('[App] Entered XR mode');
					} else {
						console.log('[App] Exited XR mode');
					}
				});

				console.log('[App] Adding render observer...');
				this.scene.onBeforeRenderObservable.add(() => {
					try {
						const now = performance.now();
						const dt = (now - lastFrameTime) / 1000;
						lastFrameTime = now;

						const moveDistance = speed * dt;

						const forward = xrCamera.getDirection(Vector3.Forward());
						const right = xrCamera.getDirection(Vector3.Right());
						const up = Vector3.Up();

						let movement = Vector3.Zero();

						if (this.keys.get('w')) movement.addInPlace(forward.scale(moveDistance));
						if (this.keys.get('s')) movement.addInPlace(forward.scale(-moveDistance));
						if (this.keys.get('d')) movement.addInPlace(right.scale(moveDistance));
						if (this.keys.get('a')) movement.addInPlace(right.scale(-moveDistance));

						if (this.keys.get(' ')) movement.addInPlace(up.scale(moveDistance));
						if (this.keys.get('control')) movement.addInPlace(up.scale(-moveDistance));

						if (!movement.equals(Vector3.Zero())) {
							xrCamera.position.addInPlace(movement);
						}

						if (document.pointerLockElement === this.canvas) {
							const mouseSensitivity = 0.005;
							this.yaw += this.mouseMovement.x * mouseSensitivity;
							this.pitch += this.mouseMovement.y * mouseSensitivity;

							this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));

							const rot = Quaternion.RotationYawPitchRoll(this.yaw, this.pitch, 0);
							xrCamera.rotationQuaternion = rot;
						}

						this.mouseMovement.x = 0;
						this.mouseMovement.y = 0;
					} catch (renderErr) {
						console.error('[App] Render loop error:', renderErr);
					}
				});
				console.log('[App] Render observer added');
			}
		} catch (e) {
			console.error('[App] WebXR initialization failed:', e);
		}

		console.log('[App] _handleLoad complete');

		// Build clip playback UI
		this._createAvatarUI(avatar, secondCharacter);
	}

	private _createAvatarUI(avatar: any, secondCharacter:any): void {
		const container = document.createElement('div');
		container.style.cssText = 'position:fixed;top:16px;right:16px;display:flex;flex-direction:column;gap:8px;z-index:50;';

		const makeBtn = (label: string, onClick: () => void) => {
			const btn = document.createElement('button');
			btn.textContent = label;
			btn.style.cssText = 'padding:8px 16px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-family:sans-serif;';
			btn.addEventListener('mouseenter', () => btn.style.background = '#1d4ed8');
			btn.addEventListener('mouseleave', () => btn.style.background = '#2563eb');
			btn.addEventListener('click', onClick);
			return btn;
		};

		container.appendChild(makeBtn('Play All', 
			() => {
				avatar.playSequence();
				secondCharacter.playSequence();
			}));

		// avatar.clips.forEach((clip: any, i: number) => {
		// 	container.appendChild(makeBtn(clip.id, () => avatar.playClip(i)));
		// });

		container.appendChild(makeBtn('Stop', () => {
			avatar.stopAndReset();
			secondCharacter.stopAndReset();
		}));

		document.body.appendChild(container);
	}

	public dispose(): void {
		this.scene?.dispose();
		this.engine?.dispose();
	}
} 
