import { AppError } from '@/shared/errors/app-error'
import type { CreateResultRequest, UpdateResultRequest } from '../dtos/result-requests'

const POOL_STYLES = new Set(['Livre', 'Costas', 'Peito', 'Borboleta', 'Medley'])
const POOL_COURSE_TYPES = new Set(['Piscina Curta', 'Piscina Longa'])
const OPEN_WATER_COURSE_TYPES = new Set(['Mar', 'Rio', 'Lago', 'Represa'])
const OPEN_WATER_STYLES = new Set(['Livre', 'Crawl'])
const OPEN_WATER_DISTANCES = new Set(['1km', '2.5km', '3km', '5km', '7.5km', '10km'])

const POOL_DISTANCES_BY_STYLE: Record<string, string[]> = {
  Livre: ['25m', '50m', '100m', '200m', '400m', '800m', '1500m'],
  Costas: ['25m', '50m', '100m', '200m'],
  Peito: ['25m', '50m', '100m', '200m'],
  Borboleta: ['25m', '50m', '100m', '200m'],
  Medley: ['100m', '200m', '400m'],
}

type ResultContextInput = Pick<
  CreateResultRequest,
  'discipline' | 'style' | 'distance' | 'customDistance' | 'competitionType' | 'courseType' | 'eventFormat'
> | Pick<
  UpdateResultRequest,
  'discipline' | 'style' | 'distance' | 'customDistance' | 'competitionType' | 'courseType' | 'eventFormat'
>

const normalize = (value?: string) => value?.trim() || ''

export const validateResultCompetitionContext = (input: ResultContextInput) => {
  const discipline = normalize(input.discipline) || 'Piscina'
  const style = normalize(input.style)
  const distance = normalize(input.distance)
  const customDistance = normalize(input.customDistance)
  const competitionType = normalize(input.competitionType)
  const courseType = normalize(input.courseType)
  const eventFormat = normalize(input.eventFormat) || 'Prova Individual'

  if (discipline === 'Piscina') {
    if (!POOL_STYLES.has(style)) {
      throw new AppError(400, 'Provas de piscina devem usar um estilo valido de piscina')
    }

    if (!POOL_COURSE_TYPES.has(courseType)) {
      throw new AppError(400, 'Provas de piscina devem usar percurso Piscina Curta ou Piscina Longa')
    }

    if (customDistance) {
      throw new AppError(400, 'Provas de piscina nao devem usar distancia personalizada')
    }

    const allowedDistances = POOL_DISTANCES_BY_STYLE[style] || []
    if (!allowedDistances.includes(distance)) {
      throw new AppError(400, `Distancia invalida para o estilo ${style}`)
    }

    if (competitionType && competitionType !== 'Piscina') {
      throw new AppError(400, 'Resultados de piscina devem usar tipo de competicao Piscina')
    }

    return
  }

  if (discipline === 'Aguas Abertas') {
    if (!OPEN_WATER_COURSE_TYPES.has(courseType)) {
      throw new AppError(400, 'Resultados de aguas abertas devem usar percurso Mar, Rio, Lago ou Represa')
    }

    if (style && !OPEN_WATER_STYLES.has(style)) {
      throw new AppError(400, 'Provas de aguas abertas devem usar estilo Livre ou Crawl')
    }

    if (competitionType && !new Set(['Aguas Abertas', 'Águas Abertas', 'Travessia']).has(competitionType)) {
      throw new AppError(400, 'Aguas abertas devem usar tipo de competicao Aguas Abertas ou Travessia')
    }

    if (eventFormat === 'Ultramaratona') {
      if (!customDistance) {
        throw new AppError(400, 'Ultramaratonas exigem distancia personalizada')
      }
      return
    }

    if (!OPEN_WATER_DISTANCES.has(distance)) {
      throw new AppError(400, 'Distancia invalida para aguas abertas')
    }

    return
  }

  throw new AppError(400, 'Disciplina invalida para o resultado')
}
