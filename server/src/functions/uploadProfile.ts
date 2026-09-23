import { Response, Request } from "express";
import { S3ServiceException, waitUntilObjectExists } from "@aws-sdk/client-s3";
import { s3BucketName, s3Client } from "../config/s3";

type S3File = Express.Multer.File & {
  key: string;
};

export const uploadProfile = async (
  req: Request & {
    file?: Express.Multer.File & { key: string };
  },
  res: Response,
) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "No file uploaded",
      });
    }

    const file = req.file as S3File;

    // Ensure file exists in S3
    await waitUntilObjectExists(
      {
        client: s3Client,
        maxWaitTime: 60,
      },
      {
        Bucket: s3BucketName,
        Key: file.key,
      },
    );

    // Return success response with file details
    res.status(200).json({
      message: "Profile picture uploaded successfully!",
      file: {
        fileName: file.originalname,
        size: file.size,
        key: file.key,
      },
    });
  } catch (e) {
    if (e instanceof S3ServiceException && e.name === "EntityTooLarge") {
      return res.status(500).json({
        message: `Error from S3 while uploading object to ${s3BucketName}. The file was too large. Upload directly to the console`,
      });
    }
    if (e instanceof S3ServiceException) {
      return res.status(500).json({
        message: `Error from S3 uploading to ${s3BucketName}. ${e.name}: ${e.message}`,
      });
    }
    return res.status(500).json({
      message: e instanceof Error ? e.message : "Internal Server Error",
    });
  }
};
