import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateCheckinDto {
    @IsUUID('4', { message: 'Invalid Student ID format' })
    @IsNotEmpty()
    studentId: string;

    @IsUUID('4', { message: 'Invalid Booth ID format' })
    @IsNotEmpty()
    boothId: string;
}
