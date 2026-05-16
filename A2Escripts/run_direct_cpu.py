import torch
import librosa
import numpy as np
import os
import sys
import traceback
from omegaconf import OmegaConf

def run():
    try:
        from engines.defaults import default_config_parser
        from engines.infer import Audio2ExpressionInfer
        
        config_file = "configs/lam_audio2exp_config_streaming.py"
        audio_input = "D:/VRE/qwenTTS/output_custom_voice_0.wav"
        save_json_path = "D:/VRE/qwenTTS/lipsync/direct_test.json"
        weight_path = "pretrained_models/lam_audio2exp_streaming.tar"

        cfg = default_config_parser(config_file, None)
        cfg.audio_input = audio_input
        cfg.save_json_path = save_json_path
        cfg.weight = weight_path
        cfg.ex_vol = False

        print("Building inferrer...")
        infer = Audio2ExpressionInfer(cfg, verbose=True)
        
        print("Running inference...")
        infer.infer()
        print("Done.")
    except Exception:
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    run()
