
import re
import json

def parse_cmu_descriptions(html_content):
    descriptions = {}
    
    # Regex to find subject blocks
    subject_blocks = re.split(r'<TR BGCOLOR=#909090>', html_content)
    
    for block in subject_blocks:
        if not block.strip():
            continue
            
        # Extract subject number
        subject_match = re.search(r'Subject #(\d+)', block)
        if not subject_match:
            continue
        subject_num = int(subject_match.group(1))
        
        # Regex to find motion rows within the block
        motion_rows = re.findall(r'<TR BGCOLOR=#FF0000>.*?<TD>(\d+)</TD>.*?<TD>(.*?)</TD>.*?</TR>', block, re.DOTALL)
        
        for motion_num_str, description in motion_rows:
            motion_num = int(motion_num_str)
            # Clean up description
            description = description.strip()
            # Create the key in the format "subject_motion"
            key = f"{subject_num:02d}_{motion_num:02d}"
            descriptions[key] = description
            
    return descriptions

def main():
    # Read the HTML content from the file
    with open('cmu_desc.html', 'r', encoding='utf-8') as f:
        html_content = f.read()

    # Parse the descriptions
    parsed_descriptions = parse_cmu_descriptions(html_content)

    # Read the original animations.json
    with open('animations.json', 'r') as f:
        animations_list = json.load(f)

    # Create the new animations data
    new_animations_data = []
    for animation_path in animations_list:
        # Extract subject and motion from the filename
        match = re.search(r'(\d+)_(\d+)\.vrma', animation_path['url'])
        if match:
            subject = int(match.group(1))
            motion = int(match.group(2))
            key = f"{subject:02d}_{motion:02d}"
            description = parsed_descriptions.get(key, "No description found.")
            new_animations_data.append({
                "url": animation_path['url'],
                "description": description
            })
        else:
            new_animations_data.append(animation_path) # Keep existing entry if regex doesn't match

    # Write the new data to animations.json
    with open('animations.json', 'w') as f:
        json.dump(new_animations_data, f, indent=2)
    
    print("animations.json has been updated with descriptions.")

if __name__ == '__main__':
    main()
