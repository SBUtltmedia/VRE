import os
import subprocess
from tqdm import tqdm

# Paths
AUDIO_DIR = "D:/VRE/qwenTTS"
SAVE_DIR = "D:/VRE/qwenTTS/lipsync"
CONFIG = "configs/lam_audio2exp_config_streaming.py"
WEIGHT = "pretrained_models/lam_audio2exp_streaming.tar"
PYTHON = r"C:\Users\pauls\miniconda3\envs\lam_a2e\python.exe"

os.makedirs(SAVE_DIR, exist_ok=True)

def process_file(audio_name, save_name):
    audio_path = os.path.join(AUDIO_DIR, audio_name)
    save_path = os.path.join(SAVE_DIR, save_name)
    
    if not os.path.exists(audio_path):
        print(f"Skipping missing file: {audio_path}")
        return
        
    print(f"\n>>> Processing {audio_name} -> {save_name} ...")
    
    cmd = [
        PYTHON, "inference.py",
        "--config-file", CONFIG,
        "--options", 
        f"audio_input={audio_path}",
        f"save_json_path={save_path}",
        f"weight={WEIGHT}",
        "ex_vol=False"
    ]
    
    try:
        subprocess.run(cmd, check=True)
        print(f"Inference complete: {save_path}")
    except subprocess.CalledProcessError as e:
        print(f"Error during processing {audio_name}: {e}")

# Process 00-11
for i in range(12):
    process_file(f"output_custom_voice_{i}.wav", f"traffic_{i:02d}.json")

# Process base
process_file("output_custom_voice.wav", "traffic_base.json")

print("\nAll tasks complete.")
