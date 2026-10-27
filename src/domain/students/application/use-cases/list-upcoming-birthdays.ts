import { StudentsRepository } from '../repositories/students-repository';

/**
 * The browser keeps the exact 0..3-day birthday window in local time.
 * Return only a small date envelope: yesterday..five days ahead in UTC
 * so clients west/east of the server never lose a local-calendar day.
 */
export class ListUpcomingBirthdaysUseCase {
  constructor(private readonly studentsRepository: StudentsRepository) {}

  async execute({
    now = new Date(),
    teacherProfileId,
  }: {
    now?: Date;
    teacherProfileId?: string;
  } = {}) {
    const utcDay = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    );
    const dayKeys = new Set<string>();

    for (let offset = -1; offset <= 5; offset += 1) {
      const day = new Date(utcDay + offset * 86_400_000);
      dayKeys.add(day.toISOString().slice(5, 10));

      // Current browser logic observes 29 February on 1 March of
      // non-leap years (Date(year, 1, 29) overflows to 1 March).
      if (
        day.getUTCMonth() === 2 &&
        day.getUTCDate() === 1 &&
        new Date(Date.UTC(day.getUTCFullYear(), 1, 29)).getUTCMonth() === 2
      ) {
        dayKeys.add('02-29');
      }
    }

    return {
      birthdays: await this.studentsRepository.listUpcomingBirthdays({
        dayKeys: [...dayKeys],
        teacherProfileId,
      }),
    };
  }
}
