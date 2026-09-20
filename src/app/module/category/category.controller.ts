import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { CategoryService } from "./category.service";

const create = catchAsync(async (req, res) => {
  const result = await CategoryService.create(req.body, req.user!.userId);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Category created",
    data: result,
  });
});

const listPublic = catchAsync(async (_req, res) => {
  const result = await CategoryService.listPublic();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Categories retrieved",
    data: result,
  });
});

const listAll = catchAsync(async (_req, res) => {
  const result = await CategoryService.listAll();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Categories retrieved",
    data: result,
  });
});

const update = catchAsync(async (req, res) => {
  const result = await CategoryService.update(
    req.params.categoryId,
    req.body,
    req.user!.userId,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Category updated",
    data: result,
  });
});

const remove = catchAsync(async (req, res) => {
  const result = await CategoryService.remove(
    req.params.categoryId,
    req.user!.userId,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result ? "Category disabled" : "Category deleted",
    data: result,
  });
});

export const CategoryController = {
  create,
  listPublic,
  listAll,
  update,
  remove,
};
