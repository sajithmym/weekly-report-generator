import { ValidationPipe } from '@nestjs/common';
import { DashboardDateFilterDto } from '../../dashboard/dto';
import { ProjectFilterDto } from '../../projects/dto';
import { ReportFilterDto } from '../../reports/dto';
import { UserFilterDto } from '../../users/dto';

describe('request validation boundary', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const validate = <T>(value: unknown, metatype: new () => T) =>
    pipe.transform(value, { type: 'query', metatype });

  it.each([ProjectFilterDto, UserFilterDto])(
    'accepts only literal boolean query values for %p',
    async (metatype) => {
      await expect(validate({ isActive: 'true' }, metatype)).resolves.toMatchObject({
        isActive: true,
      });
      await expect(validate({ isActive: 'false' }, metatype)).resolves.toMatchObject({
        isActive: false,
      });
      await expect(validate({ isActive: 'not-a-boolean' }, metatype)).rejects.toMatchObject({
        status: 400,
      });
    },
  );

  it.each([ReportFilterDto, DashboardDateFilterDto])(
    'rejects timestamps where a reporting date is required for %p',
    async (metatype) => {
      await expect(
        validate({ weekStart: '2026-09-01T00:00:00Z' }, metatype),
      ).rejects.toMatchObject({ status: 400 });
    },
  );
});
