import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createHash } from "crypto";

export interface R2Config {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  region?: string;
}

export interface SyncFile {
  path: string;
  hash: string;
  size: number;
  lastModified: Date;
}

export class R2Client {
  private s3: S3Client;
  private bucketName: string;

  constructor(config: R2Config) {
    this.s3 = new S3Client({
      endpoint: config.endpoint,
      region: config.region || "auto",
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    this.bucketName = config.bucketName;
  }

  async uploadFile(sandboxId: string, filePath: string, content: Buffer): Promise<void> {
    const key = `${sandboxId}/${filePath}`;
    const hash = this.calculateHash(content);

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: content,
          Metadata: {
            hash,
            size: content.length.toString(),
            lastModified: new Date().toISOString(),
          },
        })
      );
      console.log(`Uploaded: ${filePath} (${content.length} bytes, hash: ${hash.substring(0, 8)})`);
    } catch (error) {
      console.error(`Failed to upload ${filePath}:`, error);
      throw error;
    }
  }

  async downloadFile(sandboxId: string, filePath: string): Promise<Buffer | null> {
    const key = `${sandboxId}/${filePath}`;

    try {
      const response = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );

      if (response.Body) {
        const buffer = Buffer.from(await response.Body.transformToByteArray());
        console.log(`📥 Downloaded: ${filePath} (${buffer.length} bytes)`);
        return buffer;
      }
      return null;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "NoSuchKey") {
        console.log(`File not found in R2: ${filePath}`);
        return null;
      }
      console.error(`Failed to download ${filePath}:`, error);
      throw error;
    }
  }

  async listFiles(sandboxId: string): Promise<SyncFile[]> {
    const prefix = `${sandboxId}/`;
    const files: SyncFile[] = [];

    try {
      let continuationToken: string | undefined;

      do {
        const response = await this.s3.send(
          new ListObjectsV2Command({
            Bucket: this.bucketName,
            Prefix: prefix,
            ContinuationToken: continuationToken,
          })
        );

        if (response.Contents) {
          for (const object of response.Contents) {
            if (object.Key && object.Key !== prefix) {
              const relativePath = object.Key.substring(prefix.length);
              files.push({
                path: relativePath,
                hash: object.ETag?.replace(/"/g, "") || "",
                size: object.Size || 0,
                lastModified: object.LastModified || new Date(),
              });
            }
          }
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      console.log(`Listed ${files.length} files for sandbox ${sandboxId}`);
      return files;
    } catch (error) {
      console.error(`Failed to list files for sandbox ${sandboxId}:`, error);
      throw error;
    }
  }

  async deleteFile(sandboxId: string, filePath: string): Promise<void> {
    const key = `${sandboxId}/${filePath}`;

    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );
      console.log(`Deleted: ${filePath}`);
    } catch (error) {
      console.error(`Failed to delete ${filePath}:`, error);
      throw error;
    }
  }

  async fileExists(sandboxId: string, filePath: string): Promise<boolean> {
    const key = `${sandboxId}/${filePath}`;

    try {
      await this.s3.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );
      return true;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "NoSuchKey") {
        return false;
      }
      throw error;
    }
  }

  calculateHash(content: Buffer): string {
    return createHash("sha256").update(content).digest("hex");
  }

  async cleanup(sandboxId: string): Promise<void> {
    console.log(`Cleaning up files for sandbox ${sandboxId}`);

    try {
      const files = await this.listFiles(sandboxId);

      if (files.length === 0) {
        console.log(`No files to clean up for sandbox ${sandboxId}`);
        return;
      }

      // Delete files in batches to avoid overwhelming the API
      const batchSize = 10;
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        await Promise.all(
          batch.map(file => this.deleteFile(sandboxId, file.path))
        );
      }

      console.log(`Cleaned up ${files.length} files for sandbox ${sandboxId}`);
    } catch (error) {
      console.error(`Failed to cleanup sandbox ${sandboxId}:`, error);
      throw error;
    }
  }
}