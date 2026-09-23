import { Response, Request, NextFunction } from "express";
import { s3BucketName, s3Client } from "../config/s3";
import { HeadObjectCommand } from "@aws-sdk/client-s3";

export const checkFileExist = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { filename }: { filename: string } = req.body;
  if (!filename) {
    return res.status(400).json({ message: "No input" });
  }

  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: s3BucketName,
        Key: filename,
      }),
    );

    req.body.filename = filename;
    next();
  } catch (e) {
    return res.status(404).json({
      message: "File does not exist!",
    });
  }
};
