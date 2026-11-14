import mongoose from 'mongoose';

// Photos are kept inside the database (GridFS), so they are covered by the same login
// checks and backups as everything else, with no extra storage account needed.
const BUCKET_NAME = 'requestPhotos';

const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET_NAME });
const toObjectId = (id) => new mongoose.mongo.ObjectId(String(id));

/**
 * Identifies an image by its first bytes rather than trusting its name or the type
 * the browser claims. Returns the real type, or null if it is not an accepted image.
 */
export function detectImageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

export function saveImage({ buffer, contentType, filename, ownerId }) {
  return new Promise((resolve, reject) => {
    const upload = bucket().openUploadStream(filename, { metadata: { ownerId: String(ownerId), contentType } });
    upload.on('error', reject);
    upload.on('finish', () => resolve(upload.id.toString()));
    upload.end(buffer);
  });
}

export async function findImage(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  const [file] = await bucket().find({ _id: toObjectId(id) }).limit(1).toArray();
  return file ?? null;
}

export const openImage = (id) => bucket().openDownloadStream(toObjectId(id));

export async function deleteImages(ids) {
  for (const id of ids) {
    try {
      await bucket().delete(toObjectId(id));
    } catch {
      // Already gone: nothing to do.
    }
  }
}
