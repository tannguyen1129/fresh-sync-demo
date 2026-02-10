import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateGateCapacityDto {
  @ApiProperty()
  @IsDateString()
  startTime!: string;

  @ApiProperty()
  @IsDateString()
  endTime!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  maxSlots!: number;
}

export class UpdatePriorityRulesDto {
  @ApiProperty({ example: { vipWeight: 2, reeferWeight: 1.5 } })
  @IsObject()
  rules!: Record<string, any>;
}

export enum BlockTargetType {
  ZONE = 'ZONE',
  GATE = 'GATE',
  CONTAINER = 'CONTAINER',
}

export class BlockResourceDto {
  @ApiProperty({ enum: BlockTargetType })
  @IsEnum(BlockTargetType)
  targetType!: BlockTargetType;

  @ApiProperty({ example: 'ZONE_A' })
  @IsString()
  @IsNotEmpty()
  targetId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason!: string;
}