import httpStatus from "http-status";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { writeAuditLog } from "../../utils/audit";
import { slugify } from "../../utils/slug";

const create = async (
  payload: { name: string; description?: string },
  actorUserId: string,
) => {
  const slug = slugify(payload.name);

  if (
    await prisma.eventCategory.findFirst({
      where: { OR: [{ name: payload.name }, { slug }] },
    })
  ) {
    throw new AppError(httpStatus.CONFLICT, "Category already exists");
  }

  const category = await prisma.eventCategory.create({
    data: { ...payload, slug },
  });

  await writeAuditLog({
    actorUserId,
    action: "CATEGORY_CREATED",
    targetType: "EventCategory",
    targetId: category.id,
    newValue: category,
  });

  return category;
};

const listPublic = () =>
  prisma.eventCategory.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

const listAll = () =>
  prisma.eventCategory.findMany({
    orderBy: { name: "asc" },
  });

const update = async (
  id: string,
  payload: { name?: string; description?: string | null; isActive?: boolean },
  actorUserId: string,
) => {
  const current = await prisma.eventCategory.findUnique({ where: { id } });
  if (!current) throw new AppError(httpStatus.NOT_FOUND, "Category not found");

  const category = await prisma.eventCategory.update({
    where: { id },
    data: {
      ...payload,
      ...(payload.name ? { slug: slugify(payload.name) } : {}),
    },
  });

  await writeAuditLog({
    actorUserId,
    action: "CATEGORY_UPDATED",
    targetType: "EventCategory",
    targetId: id,
    previousValue: current,
    newValue: category,
  });

  return category;
};

const remove = async (id: string, actorUserId: string) => {
  const current = await prisma.eventCategory.findUnique({
    where: { id },
    include: { _count: { select: { events: true } } },
  });

  if (!current) throw new AppError(httpStatus.NOT_FOUND, "Category not found");

  if (current._count.events > 0) {
    return update(id, { isActive: false }, actorUserId);
  }

  await prisma.eventCategory.delete({ where: { id } });
  await writeAuditLog({
    actorUserId,
    action: "CATEGORY_DELETED",
    targetType: "EventCategory",
    targetId: id,
    previousValue: current,
  });

  return null;
};

export const CategoryService = {
  create,
  listPublic,
  listAll,
  update,
  remove,
};
