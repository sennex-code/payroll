import { Request, Response, NextFunction } from "express";
import path from "path";
export const sanitizeFile = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const fileExtensions = [".doc", ".docx", ".pdf"];
  const uploadedFiles = req.files as Express.Multer.File[];
  if (uploadedFiles.length === 0 || uploadedFiles === undefined) {
    return res.status(400).json({
      error: "No file profided",
    });
  }
  if (uploadedFiles.length > 10) {
    return res.status(400).json({
      error: "Too many uploaded files",
    });
  }
  for (const file of req.files as any[]) {
    const fileExtTmp = path.extname(file.originalname.toLowerCase());
    if (!fileExtensions.includes(fileExtTmp)) {
      return res.status(400).json({
        error: `File type of ${fileExtTmp} is not allowed. Allowed filetypes ${fileExtensions.join("")}`,
        fileType: fileExtTmp,
      });
    }
    if (file.size > 1024 * 1024 * 10) {
      return res.status(400).json({
        error: `File is too large.File name: ${file.originalname} File size: ${file.size}. Allowed: 10MB`,
      });
    }
  }
  next();
};
