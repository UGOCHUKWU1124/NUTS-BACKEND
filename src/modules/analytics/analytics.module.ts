import { Module } from '@nestjs/common';
import { AnalyticsSnapshotService } from './snapshots/analytics-snapshot.service';
import { AnalyticsReportService } from './reports/analytics-report.service';

@Module({
  providers: [AnalyticsSnapshotService, AnalyticsReportService],
  exports: [AnalyticsSnapshotService, AnalyticsReportService],
})
export class AnalyticsModule {}
