import type { Result } from '@/domain/results/enterprise/entities/result';
import type { ResultCompetitionContext } from '../repositories/results-repository';

const getResultDiscipline = (result: Result) => result.discipline || 'Piscina';

const getResultCourseType = (result: Result) =>
  result.courseType ||
  (getResultDiscipline(result) === 'Piscina'
    ? 'Piscina nao informada'
    : 'Percurso nao informado');

const getResultEventFormat = (result: Result) =>
  result.eventFormat || 'Prova Individual';

const getResultDistanceLabel = (result: Result) =>
  result.customDistance?.trim() || result.distance;

const getResultCategory = (result: Result) =>
  result.category || 'Categoria nao informada';

export const buildResultCompetitionContext = (
  result: Result,
): ResultCompetitionContext => {
  const discipline = getResultDiscipline(result);
  const courseType = getResultCourseType(result);
  const courseTypeValue = result.courseType || '';
  const competitionType = result.competitionType || discipline;
  const eventFormat = getResultEventFormat(result);
  const customDistance = result.customDistance?.trim() || '';
  const distanceLabel = getResultDistanceLabel(result);
  const category = getResultCategory(result);

  return {
    key: [
      discipline,
      competitionType,
      courseTypeValue,
      eventFormat,
      result.style,
      result.distance,
      customDistance,
      category,
    ].join('::'),
    discipline,
    competitionType,
    courseType,
    courseTypeValue,
    eventFormat,
    style: result.style,
    distance: result.distance,
    customDistance,
    distanceLabel,
    category,
    label: `${result.style} ${distanceLabel}`,
    subtitle: `${discipline} | ${courseType} | ${eventFormat} | ${category}`,
  };
};
