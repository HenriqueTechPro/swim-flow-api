import type { Result } from '../../enterprise/entities/result';

const normalizeCourseType = (value?: string) => value || '';
const normalizeCustomDistance = (value?: string) => value?.trim() || '';

const buildRecordContextKey = (result: Result) =>
  [
    result.discipline,
    result.competitionType,
    normalizeCourseType(result.courseType),
    result.eventFormat,
    result.style,
    result.distance,
    normalizeCustomDistance(result.customDistance),
    result.category,
  ].join('::');

export class ResultRecordPolicy {
  static build(results: Result[]): Result[] {
    const bestResultsByContext = new Map<string, Result>();

    const sortedResults = [...results]
      .filter((result) => result.resultStatus === 'Classificado')
      .sort((left, right) => {
        if (left.timeInSeconds !== right.timeInSeconds) {
          return left.timeInSeconds - right.timeInSeconds;
        }

        if (left.date !== right.date) {
          return left.date.localeCompare(right.date);
        }

        return left.studentName.localeCompare(right.studentName);
      });

    for (const result of sortedResults) {
      const contextKey = buildRecordContextKey(result);

      if (!bestResultsByContext.has(contextKey)) {
        bestResultsByContext.set(contextKey, result);
      }
    }

    return [...bestResultsByContext.values()].sort((left, right) => {
      const disciplineComparison = left.discipline.localeCompare(right.discipline);
      if (disciplineComparison !== 0) return disciplineComparison;

      const styleComparison = left.style.localeCompare(right.style, 'pt-BR');
      if (styleComparison !== 0) return styleComparison;

      const leftDistance = left.customDistance?.trim() || left.distance;
      const rightDistance = right.customDistance?.trim() || right.distance;
      const distanceComparison = leftDistance.localeCompare(rightDistance, 'pt-BR', {
        numeric: true,
      });
      if (distanceComparison !== 0) return distanceComparison;

      const categoryComparison = left.category.localeCompare(right.category, 'pt-BR');
      if (categoryComparison !== 0) return categoryComparison;

      const eventFormatComparison = left.eventFormat.localeCompare(right.eventFormat, 'pt-BR');
      if (eventFormatComparison !== 0) return eventFormatComparison;

      return normalizeCourseType(left.courseType).localeCompare(
        normalizeCourseType(right.courseType),
        'pt-BR',
      );
    });
  }
}
