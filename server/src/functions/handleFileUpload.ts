import { S3ServiceException, waitUntilObjectExists } from "@aws-sdk/client-s3";
import { Request, Response } from "express";
import { s3BucketName, s3Client } from "../config/s3";

type S3File = Express.Multer.File & {
  key: string;
};

export const fileUpload = async (
  req: Request & {
    file: Express.Multer.File & { key: string };
    files?: Express.Multer.File[];
  },
  res: Response,
) => {
  const uploadedFiles = [
    ...(Array.isArray(req.files) ? (req.files as S3File[]) : []),
    ...(req.file ? [req.file as S3File] : []),
  ];

  if (uploadedFiles.length === 0) {
    return res.status(400).json({
      message: "No file uploaded",
    });
  }

  try {
    // Ensure files exist
    await Promise.all(
      uploadedFiles.map((file) =>
        waitUntilObjectExists(
          {
            client: s3Client,
            maxWaitTime: 60,
          },
          {
            Bucket: s3BucketName,
            Key: file.key,
          },
        ),
      ),
    );

    // Middleware automatically handles file upload
    res.status(200).json({
      message: "Files uploaded successfully!",
      files: uploadedFiles.map((file) => ({
        fileName: file.originalname,
        size: file.size,
        key: file.key,
      })),
    });
  } catch (e) {
    if (e instanceof S3ServiceException && e.name === "EntityTooLarge") {
      return res.status(500).json({
        message: `Error from S3 while uploading object to ${s3BucketName}. The file was too large. Upload directly to the console `,
      });
    }
    if (e instanceof S3ServiceException) {
      return res.status(500).json({
        message: `Error form S3 uploading to ${s3BucketName}. ${e.name}: ${e.message}`,
      });
    }
    return res.status(500).json({
      message: e instanceof Error ? e.message : "Internal Server Error",
    });
  }
};
