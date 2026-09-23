import { GetObjectCommand } from "@aws-sdk/client-s3";
import pool from "../../config/db";
import {
  ensureLeaveApprovalColumns,
  getEmployeeProfile,
} from "../../controllers/employeeController";
import { Request, Response } from "express";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "../../config/s3";

type WithUser = Request & {
  user: {
    emp_id: number | string;
    role: string;
  };
};

export const getAllLeaves = async (req: Request, res: Response) => {
  const reqType = req as WithUser;
  try {
    await ensureLeaveApprovalColumns();
    const viewer = await getEmployeeProfile(pool, reqType.user?.emp_id);
    if (!viewer) return res.status(401).json({ message: "Unauthorized" });

    let query = `
      SELECT 
        l.*, 
        DATE_FORMAT(l.date_from, '%Y-%m-%d') as date_from,
    DATE_FORMAT(l.date_to, '%Y-%m-%d') as date_to,
        e.first_name, 
        e.last_name, 
        e.email,          
        e.designation, 
        COALESCE(e.role, 'RankAndFile') as requester_role
      FROM leave_requests l
      JOIN employees e ON l.emp_id = e.emp_id
    `;
    const queryParams = [];

    if (viewer.role === "RankAndFile") {
      query += " WHERE l.emp_id = ?";
      queryParams.push(viewer.emp_id);
    } else if (viewer.role === "Supervisor") {
      query += `
        WHERE l.emp_id = ?
           OR (
             e.designation = ?
             AND e.emp_id <> ?
           )
      `;
      queryParams.push(viewer.emp_id, viewer.designation || "", viewer.emp_id);
    }

    query += " ORDER BY l.id DESC";

    const [rows] = await pool.query(query, queryParams);

    const withSignedUrl = await Promise.all(
      (rows as any[]).map(async (row: any) => {
        let signedUrlTemp = null;

        if (row.ocp) {
          const res = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: row.ocp,
            ResponseContentType: "application/octet-stream",
          });

          const toUrl = await getSignedUrl(s3Client, res, { expiresIn: 3600 });
          signedUrlTemp = toUrl;
        }

        return {
          ...row,
          ocp: signedUrlTemp,
        };
      }),
    );

    res.json(withSignedUrl);
  } catch (error) {
    console.error("DB Error in getAllLeaves:", error);
    res.status(500).json({ message: "Error fetching leaves" });
  }
};
