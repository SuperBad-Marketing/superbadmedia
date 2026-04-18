-- CLD-1: Add cloudinary_gallery_folder to deals (replaces Pixieset link-out model).
ALTER TABLE deals ADD COLUMN cloudinary_gallery_folder TEXT;
