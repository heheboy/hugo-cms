use std::fs::File;
use std::io::Write;

fn main() {
    // Create a minimal valid ICO file
    let icon_path = std::path::Path::new("icons/icon.ico");
    if !icon_path.exists() {
        if let Some(parent) = icon_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        // ICO file structure:
        // Header (6 bytes) + Directory Entry (16 bytes per image) + Image Data

        // Header: Reserved (2), Type (1 = ICO), Count (1)
        let header: [u8; 6] = [0x00, 0x00, 0x01, 0x00, 0x01, 0x00];

        // Directory Entry for 32x32 32-bit image:
        // Width, Height, Colors (0 = >256), Reserved, Color Planes, Bits per pixel, Size in bytes, Offset
        let entry: [u8; 16] = [
            0x20, // Width (32)
            0x20, // Height (32)
            0x00, // Colors (0 = >256)
            0x00, // Reserved
            0x01, 0x00, // Color planes (1)
            0x20, 0x00, // Bits per pixel (32)
            0x08, 0x00, 0x00, 0x00, // Size in bytes (32*32*4 + 40 = 4136, but we'll use small value)
            0x16, 0x00, 0x00, 0x00, // Offset (22 = 6 + 16)
        ];

        // BITMAPINFOHEADER (40 bytes)
        let bmp_header: [u8; 40] = [
            0x28, 0x00, 0x00, 0x00, // Size (40)
            0x20, 0x00, 0x00, 0x00, // Width (32)
            0x40, 0x00, 0x00, 0x00, // Height (64 = 32 + 32 for XOR and AND masks)
            0x01, 0x00, // Planes (1)
            0x20, 0x00, // Bits per pixel (32)
            0x00, 0x00, 0x00, 0x00, // Compression (0 = BI_RGB)
            0x00, 0x00, 0x00, 0x00, // Image size (0 for BI_RGB)
            0x00, 0x00, 0x00, 0x00, // X pixels per meter
            0x00, 0x00, 0x00, 0x00, // Y pixels per meter
            0x00, 0x00, 0x00, 0x00, // Colors used
            0x00, 0x00, 0x00, 0x00, // Important colors
        ];

        // Pixel data (32x32 x 4 bytes BGRA) + AND mask (32x32 / 8 = 128 bytes)
        let pixel_data: Vec<u8> = vec![0; 32 * 32 * 4 + 128];

        // Combine all parts
        let mut ico_data: Vec<u8> = Vec::new();
        ico_data.extend_from_slice(&header);
        ico_data.extend_from_slice(&entry);
        ico_data.extend_from_slice(&bmp_header);
        ico_data.extend_from_slice(&pixel_data);

        // Update the size in entry
        let size = ico_data.len() - 22;
        ico_data[14] = size as u8;
        ico_data[15] = (size >> 8) as u8;
        ico_data[16] = (size >> 16) as u8;
        ico_data[17] = (size >> 24) as u8;

        if let Ok(mut file) = File::create(icon_path) {
            let _ = file.write_all(&ico_data);
            println!("Created placeholder icon.ico");
        }
    }

    tauri_build::build()
}
