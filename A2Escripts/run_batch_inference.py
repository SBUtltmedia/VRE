import os
import subprocess

# Paths on D: drive
BASE_VRE = "D:/VRE"
AUDIO_DIR = os.path.join(BASE_VRE, "qwenTTS")
SAVE_DIR = os.path.join(BASE_VRE, "qwenTTS", "lipsync")
CONFIG = "configs/lam_audio2exp_config_streaming.py"
WEIGHT = "pretrained_models/lam_audio2exp_streaming.tar"
CONVERTER = os.path.join(BASE_VRE, "convert_bsdata_to_vrma.mjs")

os.makedirs(SAVE_DIR, exist_ok=True)

def process_file(audio_name, save_name):
    audio_path = os.path.join(AUDIO_DIR, audio_name)
    save_path = os.path.join(SAVE_DIR, save_name)
    
    if not os.path.exists(audio_path):
        print(f"Skipping missing file: {audio_path}")
        return
        
    print(f"\n>>> Processing {audio_name} -> {save_name} ...")
    
    # 1. Inference
    cmd = [
        "python", "inference.py",
        "--config-file", CONFIG,
        "--options", 
        f"audio_input={audio_path}",
        f"save_json_path={save_path}",
        f"weight={WEIGHT}",
        "ex_vol=False" # Ensure vocal extraction
    ]
    
    try:
        subprocess.run(cmd, check=True)
        print(f"Inference complete: {save_path}")
        
        # 2. Conversion to VRMA
        print(f"Converting to VRMA...")
        # Note: We use 'node' to run the .mjs script
        conv_cmd = ["node", CONVERTER, save_path]
        subprocess.run(conv_cmd, check=True)
        
    except subprocess.CalledProcessError as e:
        print(f"Error during processing {audio_name}: {e}")

# Process 00-11
for i in range(12):
    process_file(f"output_custom_voice_{i}.wav", f"traffic_{i:02d}.json")

# Process base
process_file("output_custom_voice.wav", "traffic_base.json")

print("\nAll tasks complete.")
