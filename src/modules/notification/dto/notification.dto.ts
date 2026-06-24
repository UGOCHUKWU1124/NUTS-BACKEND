import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  IsEnum,
} from 'class-validator';

export class SendEmailDto {
  @IsEmail()
  @IsNotEmpty()
  to!: string;

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsNotEmpty()
  html!: string;

  @IsOptional()
  @IsString()
  text?: string;
}

export class SendBulkEmailDto {
  @IsArray()
  @IsEmail({}, { each: true })
  recipients!: string[];

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsNotEmpty()
  html!: string;
}

export enum NotificationType {
  EMAIL = 'email',
  IN_APP = 'in_app',
}

export class NotificationPayloadDto {
  @IsEnum(NotificationType)
  type!: NotificationType;

  @IsString()
  @IsNotEmpty()
  eventName!: string;

  @IsNotEmpty()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  email?: string;
}
