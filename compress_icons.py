"""
Icon Optimizer for Chrome Extension
Compresses PNG icons while maintaining quality
"""
from PIL import Image
import os

ICON_DIR = r"c:\Users\LENOVO\Downloads\Flowtext Expander\icons"
SIZES = {
    "icon16.png": 16,
    "icon32.png": 32,
    "icon48.png": 48,
    "icon128.png": 128
}

def compress_icon(filepath, target_size):
    """Compress a PNG icon to be smaller"""
    img = Image.open(filepath)
    
    # Convert to RGBA if not already
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    # Resize to exact dimensions needed
    img = img.resize((target_size, target_size), Image.Resampling.LANCZOS)
    
    # Get file size before
    original_size = os.path.getsize(filepath)
    
    # Save with optimization
    # Create backup first
    backup_path = filepath.replace('.png', '_original.png')
    if not os.path.exists(backup_path):
        os.rename(filepath, backup_path)
    
    # Save optimized version
    img.save(filepath, 'PNG', optimize=True)
    
    new_size = os.path.getsize(filepath)
    
    print(f"{os.path.basename(filepath)}: {original_size/1024:.1f}KB -> {new_size/1024:.1f}KB ({(1-new_size/original_size)*100:.1f}% reduction)")
    
    return original_size, new_size

def main():
    total_original = 0
    total_new = 0
    
    print("Compressing Chrome extension icons...\n")
    
    for filename, size in SIZES.items():
        filepath = os.path.join(ICON_DIR, filename)
        if os.path.exists(filepath):
            orig, new = compress_icon(filepath, size)
            total_original += orig
            total_new += new
        else:
            print(f"Warning: {filename} not found")
    
    print(f"\nTotal: {total_original/1024:.1f}KB -> {total_new/1024:.1f}KB")
    print(f"Overall reduction: {(1-total_new/total_original)*100:.1f}%")
    print("\nOriginal files backed up with '_original' suffix")

if __name__ == "__main__":
    main()
