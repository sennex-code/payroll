import { Request, Response } from "express";
import { s3BucketName, s3Client } from "../config/s3";
import { GetObjectCommand, S3ServiceException } from "@aws-sdk/client-s3";

export const retrieveFile = async (req: Request, res: Response) => {
  const filenameFromBody = req.body?.filename;
  const filenameFromQuery =
    typeof req.query?.filename === "string" ? req.query.filename : "";
  const filename: string = String(filenameFromBody || filenameFromQuery || "");
  if (!filename) {
    return res.status(400).json({
      message: "No filename",
    });
  }

  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: s3BucketName,
        Key: filename,
      }),
    );

    // Set headers for preview (inline display)
    res.setHeader("Content-Type", response.ContentType || "application/octet-stream");
    res.setHeader("Content-Length", response.ContentLength || "0");
    res.setHeader("Content-Disposition", `inline; filename="${filename.split("_").pop()}"`);

    // Stream the file to the response
    if (response.Body) {
      response.Body.pipe(res);
    } else {
      res.status(500).json({ message: "File body is empty" });
    }
  } catch (e) {
    if (e instanceof S3ServiceException && e.name === "NoSuchKey") {
      return res.status(404).json({
        message: "File not found",
      });
    }
    if (e instanceof S3ServiceException) {
      return res.status(500).json({
        message: `Error retrieving file from S3: ${e.message}`,
      });
    }
    return res.status(500).json({
      message: e instanceof Error ? e.message : "Internal server error",
    });
  }
};
