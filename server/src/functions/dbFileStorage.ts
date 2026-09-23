import { randomUUID } from "crypto";
import pool from "../config/db.js";

let ensuredDbFilesTable = false;

const ensureDbFilesTable = async () => {
  if (ensuredDbFilesTable) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stored_files (
      storage_key VARCHAR(120) PRIMARY KEY,
      original_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(120) NOT NULL,
      size_bytes INT NOT NULL,
      content LONGBLOB NOT NULL,
      created_by VARCHAR(50) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_stored_files_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  ensuredDbFilesTable = true;
};

export const saveDbStoredFile = async ({
  originalName,
  mimeType,
  sizeBytes,
  content,
  createdBy,
}: {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  content: Buffer;
  createdBy?: string | null;
}) => {
  await ensureDbFilesTable();

  const storageKey = `file_${randomUUID()}`;
  await pool.query(
    `INSERT INTO stored_files (storage_key, original_name, mime_type, size_bytes, content, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      storageKey,
      originalName,
      mimeType,
      sizeBytes,
      content,
      createdBy || null,
    ],
  );

  return storageKey;
};

export const getDbStoredFileByKey = async (storageKey: string) => {
  await ensureDbFilesTable();

  const [rows] = await pool.query(
    `SELECT storage_key, original_name, mime_type, size_bytes, content
     FROM stored_files
     WHERE storage_key = ?
     LIMIT 1`,
    [storageKey],
  );

  const row = Array.isArray(rows) && rows.length ? (rows[0] as any) : null;
  if (!row) return null;

  return {
    storageKey: row.storage_key,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes || 0),
    content: row.content as Buffer,
  };
};

export const dbStoredFileExists = async (storageKey: string) => {
  await ensureDbFilesTable();

  const [rows] = await pool.query(
    `SELECT storage_key FROM stored_files WHERE storage_key = ? LIMIT 1`,
    [storageKey],
  );

  return Array.isArray(rows) && rows.length > 0;
};

export const deleteDbStoredFileByKey = async (storageKey: string) => {
  await ensureDbFilesTable();

  await pool.query(`DELETE FROM stored_files WHERE storage_key = ?`, [storageKey]);
};
