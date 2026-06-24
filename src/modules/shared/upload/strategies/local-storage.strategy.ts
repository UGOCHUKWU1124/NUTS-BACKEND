import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  StorageStrategy,
  FileUploadOptions,
  UploadedFile,
  UploadableFile,
} from '../upload.interface';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LocalStorageStrategy extends StorageStrategy {
  private readonly uploadPath: string;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    super();
    this.uploadPath = path.resolve(process.cwd(), 'uploads');
    this.baseUrl = this.config.getOrThrow<string>('BASE_URL');
  }

  async upload(
    file: UploadableFile,
    options?: FileUploadOptions,
  ): Promise<UploadedFile> {
    const folder = options?.folder || 'general';
    const fileName = options?.fileName || `${Date.now()}-${file.originalname}`;
    const targetDir = path.join(this.uploadPath, folder);
    const targetPath = path.join(targetDir, fileName);

    try {
      await fs.mkdir(targetDir, { recursive: true });
      await fs.writeFile(targetPath, file.buffer);

      return {
        url: `${this.baseUrl}/${folder}/${fileName}`,
        key: `${folder}/${fileName}`,
        mimeType: file.mimetype,
        size: file.size,
      };
    } catch {
      throw new InternalServerErrorException('Failed to upload file locally');
    }
  }

  async delete(key: string): Promise<void> {
    const targetPath = path.join(this.uploadPath, key);
    try {
      await fs.unlink(targetPath);
    } catch {
      // Ignore if file doesn't exist
    }
  }
}
