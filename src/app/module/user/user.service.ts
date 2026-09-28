import type { UploadApiResponse } from "cloudinary";
import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";

const uploadProfileImage = async (
	buffer: Buffer,
	userId: string,
) => {
	// --------------------------------
	// Find current profile image
	// --------------------------------

	const currentUser =
		await prisma.user.findUnique({
			where: {
				id: userId,
			},
			select: {
				id: true,
				imageUrl: true,
				imagePublicId: true,
			},
		});

	if (!currentUser) {
		throw new Error("User not found");
	}

	// --------------------------------
	// Upload new image to Cloudinary
	// --------------------------------

	const cloudinaryResult =
		await new Promise<UploadApiResponse>(
			(resolve, reject) => {
				const uploadStream =
					cloudinary.uploader.upload_stream(
						{
							resource_type: "image",
							folder:
								"eventflow/profile-images",
						},

						(error, result) => {
							if (error) {
								return reject(error);
							}

							if (!result) {
								return reject(
									new Error(
										"No result returned from Cloudinary",
									),
								);
							}

							resolve(result);
						},
					);

				uploadStream.end(buffer);
			},
		);

	// --------------------------------
	// Update User in PostgreSQL
	// --------------------------------

	const updatedUser =
		await prisma.user.update({
			where: {
				id: userId,
			},

			data: {
				imageUrl:
					cloudinaryResult.secure_url,

				imagePublicId:
					cloudinaryResult.public_id,
			},

			omit: {
				password: true,
			},
		});

	// --------------------------------
	// Delete old Cloudinary image
	// --------------------------------

	if (currentUser.imagePublicId) {
		try {
			await cloudinary.uploader.destroy(
				currentUser.imagePublicId,
			);
		} catch (error) {
			console.error(
				"Failed to delete old profile image:",
				error,
			);
		}
	}

	return updatedUser;
};

const updateMyProfile = async (
  userId: string,
  payload: {
    name?: string;
    phone?: string | null;
    attendee?: {
      phone?: string | null;
      location?: string | null;
    };
  },
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { attendee: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(payload.name ? { name: payload.name } : {}),
      ...("phone" in payload ? { phone: payload.phone } : {}),
      ...(payload.attendee && user.attendee
        ? {
            attendee: {
              update: {
                ...("phone" in payload.attendee
                  ? { phone: payload.attendee.phone }
                  : {}),
                ...("location" in payload.attendee
                  ? { location: payload.attendee.location }
                  : {}),
              },
            },
          }
        : {}),
    },
    include: {
      attendee: true,
      organizer: true,
      eventStaff: true,
    },
    omit: { password: true },
  });
};

export const UserServices = {
  uploadProfileImage,
  updateMyProfile,
};