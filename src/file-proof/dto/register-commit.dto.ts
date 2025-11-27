import { IsNotEmpty, IsString, IsNumber } from 'class-validator';

export class RegisterCommitDto {
  @IsNotEmpty({ message: 'commit은 필수 항목입니다' })
  @IsString({ message: 'commit은 문자열이어야 합니다' })
  commit: string;

  @IsNotEmpty({ message: 'timestamp는 필수 항목입니다' })
  @IsNumber({}, { message: 'timestamp는 숫자여야 합니다' })
  timestamp: number;

  @IsNotEmpty({ message: 'serverSignature는 필수 항목입니다' })
  @IsString({ message: 'serverSignature는 문자열이어야 합니다' })
  serverSignature: string;
}
