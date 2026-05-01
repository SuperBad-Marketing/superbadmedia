import { v2 as cloudinary } from 'cloudinary'

function ensureConfigured(): boolean {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) return false

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  })

  return true
}

export interface CloudinaryUploadResult {
  publicId: string
  url: string
  secureUrl: string
  format: string
  duration?: number
  width?: number
  height?: number
  bytes: number
}

export async function uploadToCloudinary(
  filePath: string,
  options: {
    folder?: string
    publicId?: string
    resourceType?: 'video' | 'image' | 'raw'
  } = {},
): Promise<CloudinaryUploadResult> {
  if (!ensureConfigured()) {
    throw new Error('Cloudinary not configured. Add credentials in Settings.')
  }

  const result = await cloudinary.uploader.upload(filePath, {
    resource_type: options.resourceType || 'video',
    folder: options.folder || 'superedits',
    public_id: options.publicId,
    overwrite: true,
  })

  return {
    publicId: result.public_id,
    url: result.url,
    secureUrl: result.secure_url,
    format: result.format,
    duration: result.duration,
    width: result.width,
    height: result.height,
    bytes: result.bytes,
  }
}

export function getCloudinaryGalleryUrl(
  publicId: string,
  options: {
    width?: number
    height?: number
    format?: string
    quality?: string
  } = {},
): string {
  if (!ensureConfigured()) {
    throw new Error('Cloudinary not configured')
  }

  return cloudinary.url(publicId, {
    resource_type: 'video',
    width: options.width,
    height: options.height,
    format: options.format || 'mp4',
    quality: options.quality || 'auto',
    secure: true,
  })
}

export async function listCloudinaryFolders(prefix?: string): Promise<{ name: string; path: string }[]> {
  if (!ensureConfigured()) {
    throw new Error('Cloudinary not configured')
  }

  try {
    const result = prefix
      ? await cloudinary.api.sub_folders(prefix)
      : await cloudinary.api.root_folders()

    return (result.folders || []).map((f: any) => ({
      name: f.name,
      path: f.path,
    }))
  } catch (err: any) {
    if (err?.error?.http_code === 404) return []
    throw err
  }
}

export async function createCloudinaryFolder(folderPath: string): Promise<void> {
  if (!ensureConfigured()) {
    throw new Error('Cloudinary not configured')
  }

  await cloudinary.api.create_folder(folderPath)
}

export function isCloudinaryConfigured(): boolean {
  return ensureConfigured()
}
