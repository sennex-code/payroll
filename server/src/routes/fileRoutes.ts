import express from "express";
import multer from "multer";
import multerS3 from "multer-s3";
import { fileUpload } from "../functions/handleFileUpload";
import { s3BucketName, s3Client } from "../config/s3";

import { retrieveFile } from "../functions/retrieveFile";
import { sanitizeFile } from "../middleware/sanitizeFile";
import { deleteFile } from "../functions/deleteFile";
import { checkFileExist } from "../middleware/checkFileExist";
import { upload } from "../middleware/upload";
import { uploadProfile } from "../functions/uploadProfile";
import { authenticateToken } from "../middleware/authMiddleware.js";

const uploadS3 = multer({
  storage: multerS3({
    // Cloudflare r2 Endpoint
    s3: s3Client,
    // Storage name
    bucket: s3BucketName,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: (req, file, cb) => {
      cb(null, { fieldname: file.fieldname });
    },

    // Will handle upload
    key: (req, file, cb) => {
      // File convention
      const fileName =
        Date.now() + "_" + file.fieldname + "_" + file.originalname;

      cb(null, fileName);
    },
  }),
  limits: {
    fileSize: 1024 * 1024 * 10,
  },
});

const router = express.Router();
router.use(authenticateToken as any);

const handleUpload = (req: any, res: any, next: any) => {
  uploadS3.array("requiredFiles", 10)(req, res, (err: any) => {
    if (err) {
      return res.status(500).json({
        message: err.message || "File upload failed",
      });
    }
    return next();
  });
};

router.post("/upload", handleUpload, sanitizeFile, fileUpload as any);
router.get("/get", retrieveFile);
router.delete("/delete", checkFileExist, deleteFile);

router.post(
  "/uploadProfile",
  upload.single("profile-picture"),
  // checkFileExist,
  uploadProfile,
);

export default router;
