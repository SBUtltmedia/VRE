import os
import subprocess
import sys
from pathlib import Path

def run_command(command, description):
    """Run a shell command and handle errors"""
    print(f"\n{description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} completed successfully")
        if result.stdout:
            print(f"Output: {result.stdout}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed with error: {e}")
        print(f"Error output: {e.stderr}")
        return False

def check_conda_installed():
    """Check if conda is installed"""
    try:
        result = subprocess.run(["conda", "--version"], capture_output=True, text=True)
        return result.returncode == 0
    except:
        return False

def create_conda_environment():
    """Create conda environment for hy-motion-fbx"""
    print("🔍 Checking conda installation...")
    if not check_conda_installed():
        print("❌ Conda is not installed or not in PATH")
        print("Please install Anaconda or Miniconda first")
        return False
    
    print("✅ Conda is installed")
    
    # Remove existing environment if it exists
    env_name = "hy-motion-fbx"
    print(f"\n🗑️  Removing existing environment '{env_name}' if it exists...")
    run_command(f"conda remove -n {env_name} --all -y", "Removing existing environment")
    
    # Create new environment
    print(f"\n🌱 Creating conda environment '{env_name}'...")
    if not run_command(f"conda create -n {env_name} python=3.10 -y", "Creating conda environment"):
        return False
    
    # Activate environment and install dependencies
    print(f"\n🔧 Installing dependencies in environment '{env_name}'...")
    
    # Get absolute path to the env's pip
    conda_base = os.path.dirname(os.path.dirname(os.path.dirname(subprocess.run(["where", "conda"], capture_output=True, text=True).stdout.splitlines()[0])))
    pip_path = os.path.join(conda_base, "envs", env_name, "Scripts", "pip.exe")
    if not os.path.exists(pip_path):
        # Fallback for some miniconda versions
        pip_path = os.path.join(os.environ['USERPROFILE'], "miniconda3", "envs", env_name, "Scripts", "pip.exe")

    print(f"Using pip at: {pip_path}")

    commands = [
        f"{pip_path} install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124",
        f"{pip_path} install transformers>=4.40 bitsandbytes>=0.43 accelerate>=0.30 huggingface_hub>=0.20",
        f"{pip_path} install scipy>=1.10 pyyaml>=6.0 numpy>=1.24 torchdiffeq>=0.2.0",
        f"{pip_path} install click>=8.0 requests>=2.28 psutil>=5.9 rich>=13.0 websocket-client>=1.6"
    ]
    
    for cmd in commands:
        if not run_command(cmd, f"Installing {cmd.split()[-1]}"):
            return False
    
    print("\n✅ Environment setup completed successfully!")
    return True

def generate_traffic_prompts():
    """Generate prompts based on the traffic scene dialog"""
    prompts = [
        {
            "prompt": "nervous driver sitting in car, hands on steering wheel, tense posture, looking forward with anxiety",
            "duration": 4,
            "character": "jordan",
            "emotion": "nervous"
        },
        {
            "prompt": "police officer standing outside car window, authoritative stance, hand on weapon, stern expression",
            "duration": 3,
            "character": "officer", 
            "emotion": "authoritative"
        },
        {
            "prompt": "confident young driver gesturing with frustration, leaning forward in seat, defensive body language",
            "duration": 5,
            "character": "jordan",
            "emotion": "frustrated"
        },
        {
            "prompt": "police officer pointing at driver, commanding hand motion, serious facial expression",
            "duration": 7,
            "character": "officer",
            "emotion": "commanding"
        },
        {
            "prompt": "scared teenager reaching slowly toward lap, fearful expression, hesitant movements",
            "duration": 8,
            "character": "jordan",
            "emotion": "fearful"
        },
        {
            "prompt": "police officer shouting with intensity, aggressive hand gestures, angry facial expression",
            "duration": 6,
            "character": "officer",
            "emotion": "angry"
        },
        {
            "prompt": "driver showing submission, hands raised slowly, cooperative posture, pleading expression",
            "duration": 4,
            "character": "jordan",
            "emotion": "submissive"
        },
        {
            "prompt": "police officer giving commands with sharp hand motions, intense eye contact",
            "duration": 6,
            "character": "officer",
            "emotion": "intense"
        },
        {
            "prompt": "driver trying to reason, reaching for wallet with one hand, pleading expression",
            "duration": 5,
            "character": "jordan",
            "emotion": "pleading"
        },
        {
            "prompt": "police officer yelling, gun drawn, warning gesture, threatening posture",
            "duration": 9,
            "character": "officer",
            "emotion": "threatening"
        },
        {
            "prompt": "driver terrified with hands in air, trembling, wide-eyed fear, submissive body language",
            "duration": 5,
            "character": "jordan",
            "emotion": "terrified"
        },
        {
            "prompt": "police officer giving calm but firm instructions, controlled hand motions, authoritative but not aggressive",
            "duration": 5,
            "character": "officer",
            "emotion": "controlled"
        }
    ]
    
    return prompts

def save_prompts_to_file():
    """Save prompts to a JSON file"""
    prompts = generate_traffic_prompts()
    
    import json
    output_file = "D:\\VRE\\hy_motion_prompts.json"
    
    with open(output_file, 'w') as f:
        json.dump({
            "scene": "The Traffic Stop",
            "description": "A tense traffic stop escalation between Jordan and Officer Miller",
            "prompts": prompts
        }, f, indent=2)
    
    print(f"📝 Prompts saved to: {output_file}")
    return output_file

def create_batch_script():
    """Create a batch script for easy execution"""
    batch_content = """@echo off
echo Setting up HY-Motion FBX environment...

echo Creating conda environment...
python hy_motion_setup.py

echo Setting up environment variables...
call conda activate hy-motion-fbx

echo Downloading HY-Motion models...
hy-motion-fbx --download

echo Running conversion script...
hy-motion-fbx --input "D:\\VRE\\models\\AIAN\\converted\\" --output "D:\\VRE\\hy_motion_output\\"

echo Process completed!
pause
"""
    
    batch_file = "D:\\VRE\\setup_hy_motion.bat"
    with open(batch_file, 'w') as f:
        f.write(batch_content)
    
    print(f"📋 Batch script created: {batch_file}")
    return batch_file

def main():
    """Main setup function"""
    print("🚀 Starting HY-Motion FBX Exporter Setup")
    print("=" * 50)
    
    # Change to the VRE directory
    os.chdir("D:\\VRE")
    
    # Create conda environment
    if not create_conda_environment():
        print("\n❌ Environment setup failed")
        return False
    
    # Generate and save prompts
    prompts_file = save_prompts_to_file()
    
    # Create batch script
    batch_file = create_batch_script()
    
    print("\n" + "=" * 50)
    print("🎉 HY-Motion FBX Exporter Setup Complete!")
    print("\nNext steps:")
    print("1. Run the batch script: setup_hy_motion.bat")
    print("2. Or run manually:")
    print("   conda activate hy-motion-fbx")
    print("   hy-motion-fbx --help")
    print(f"3. Use prompts from: {prompts_file}")
    print(f"4. Converted FBX files are in: D:\\VRE\\models\\AIAN\\converted\\")
    
    return True

if __name__ == "__main__":
    main()