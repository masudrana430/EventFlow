import type { UploadApiOptions, UploadApiResponse } from "cloudinary";
import { cloudinary } from "./cloudinary";

export const uploadBuffer = (
  buffer: Buffer,
  options: UploadApiOptions,
): Promise<UploadApiResponse> =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      if (!result) return reject(new Error("Cloudinary returned no upload result"));
      resolve(result);
    });

    stream.end(buffer);
  });

export const safeDestroyAsset = async (
  publicId?: string | null,
  resourceType: "image" | "raw" = "image",
) => {
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (error) {
    console.error("Cloudinary cleanup failed:", error);
  }
};
