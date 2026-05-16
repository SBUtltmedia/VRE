import torch
import os
import sys

print("Testing torch load...")
try:
    path = "pretrained_models/lam_audio2exp_streaming.tar"
    checkpoint = torch.load(path, map_location="cpu")
    print("Checkpoint keys:", checkpoint.keys())
    print("State dict keys count:", len(checkpoint["state_dict"]))
except Exception as e:
    print("Error:", e)
    sys.exit(1)

print("Success.")
