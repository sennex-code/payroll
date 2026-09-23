import { Request, Response } from "express";

import { s3BucketName, s3Client } from "../config/s3";
import {
  DeleteObjectCommand,
  S3ServiceException,
  waitUntilObjectNotExists,
} from "@aws-sdk/client-s3";

export const deleteFile = async (req: Request, res: Response) => {
  const filename = req.body.filename;

  try {
    // Delete the file
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: s3BucketName,
        Key: filename,
      }),
    );
    // Ensure the file is deleted before ending the request
    await waitUntilObjectNotExists(
      {
        client: s3Client,
        // 60 seconds to finish before
        maxWaitTime: 60,
      },
      //   Targets the bucket
      {
        Bucket: s3BucketName,
        Key: filename,
      },
    );

    return res.status(200).json({ message: "File has been deleted" });
  } catch (e) {
    if (e instanceof S3ServiceException && e.name === "NoSuchBucket")
      return res.status(500).json({
        message: `Error from S3 while deleting object from ${s3BucketName}. The bucket doesn't exist.`,
      });
    if (e instanceof S3ServiceException) {
      return res.status(500).json({
        message: `Error form S3 while deleting object from ${s3BucketName}. ${e.name} : ${e.message}`,
      });
    }
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};
