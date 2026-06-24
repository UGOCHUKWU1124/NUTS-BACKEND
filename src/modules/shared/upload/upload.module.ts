import { Module, Global } from '@nestjs/common';
import { StorageStrategy } from 'src/modules/shared/upload/upload.interface';
import { LocalStorageStrategy } from 'src/modules/shared/upload/strategies/local-storage.strategy';

@Global()
@Module({
  providers: [
    {
      provide: StorageStrategy,
      useClass: LocalStorageStrategy, // Production grade: easily swap this with S3StorageStrategy
    },
  ],
  exports: [StorageStrategy],
})
export class UploadModule {}
