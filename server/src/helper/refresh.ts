import { Request, Response } from "express";
import { createAccessToken, verifyRefreshToken } from "./jwt";

const refresh = (req: Request, res: Response) => {
  const refresh_token = req.cookies.refresh_token;

  try {
    if (!refresh_token) {
      return res
        .status(401)
        .json({ message: "Invalid or expired refresh token" });
    }

    const payload = verifyRefreshToken(refresh_token) as {
      emp_id: number | string;
      role: string;
      iat?: number;
      exp?: number;
    };

    const newToken = createAccessToken({
      emp_id: payload.emp_id,
      role: payload.role,
    });

    return res.status(200).json({
      token: newToken,
    });
  } catch (e) {
    console.error("Refresh error:", e);
    return res.status(401).json({ message: "Server error during refresh" });
  }
};

export default refresh;
