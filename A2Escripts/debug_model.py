import torch
import sys
from models.network import Audio2Expression
from transformers import Wav2Vec2Config

print("Testing Audio2Expression build...")
try:
    # Build a dummy config
    backbone_cfg = dict(
        type="Audio2Expression",
        pretrained_encoder_type='wav2vec',
        pretrained_encoder_path='facebook/wav2vec2-base-960h',
        wav2vec2_config_path = 'configs/wav2vec2_config.json',
        num_identity_classes=12,
        identity_feat_dim=64,
        hidden_dim=512,
        expression_dim=52,
        norm_type='ln',
        use_transformer=False,
        num_attention_heads=8,
        num_transformer_layers=6,
    )
    
    # Remove 'type' before passing to class
    backbone_cfg.pop('type')
    
    model = Audio2Expression(**backbone_cfg)
    print("Model built successfully.")
    
    print("Testing weight load...")
    path = "pretrained_models/lam_audio2exp_streaming.tar"
    checkpoint = torch.load(path, map_location="cpu", weights_only=True)
    state_dict = checkpoint["state_dict"]
    
    # Clean state dict keys
    new_state_dict = {}
    for k, v in state_dict.items():
        name = k[7:] if k.startswith("module.") else k
        new_state_dict[name] = v
        
    model.load_state_dict(new_state_dict)
    print("Weights loaded successfully.")

except Exception as e:
    import traceback
    traceback.print_exc()
    sys.exit(1)
