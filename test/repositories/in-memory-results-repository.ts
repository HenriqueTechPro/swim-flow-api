import { AppError } from '@/shared/errors/app-error'
import type {
  CreateResultRepositoryInput,
  ListResultsRepositoryParams,
  UpdateResultRepositoryInput,
} from '@/domain/results/application/repositories/results-repository'
import { ResultsRepository } from '@/domain/results/application/repositories/results-repository'
import type { Result } from '@/domain/results/enterprise/entities/result'
import { paginateItems } from '@/domain/shared/pagination/pagination-utils'
import { makeResult } from '../factories/make-result'

export class InMemoryResultsRepository implements ResultsRepository {
  public items: Result[] = []

  async list(params?: ListResultsRepositoryParams) {
    const search = params?.search?.trim().toLowerCase()
    const discipline = params?.discipline?.trim()
    const style = params?.style?.trim()
    const distance = params?.distance?.trim()
    const competition = params?.competition?.trim()
    const competitionType = params?.competitionType?.trim()
    const courseType = params?.courseType?.trim()
    const eventFormat = params?.eventFormat?.trim()
    const resultStatus = params?.resultStatus?.trim()
    const category = params?.category?.trim()
    const startDate = params?.startDate?.trim()
    const endDate = params?.endDate?.trim()
    const studentId = params?.studentId?.trim()

    const filteredItems = this.items.filter((item) => {
      const matchesSearch =
        !search ||
        item.studentName.toLowerCase().includes(search) ||
        item.style.toLowerCase().includes(search) ||
        item.competition.toLowerCase().includes(search)
      const matchesDiscipline = !discipline || item.discipline === discipline
      const matchesStyle = !style || item.style === style
      const matchesDistance = !distance || item.distance === distance
      const matchesCompetition = !competition || item.competition === competition
      const matchesCompetitionType = !competitionType || item.competitionType === competitionType
      const matchesCourseType = !courseType || item.courseType === courseType
      const matchesEventFormat = !eventFormat || item.eventFormat === eventFormat
      const matchesResultStatus = !resultStatus || item.resultStatus === resultStatus
      const matchesCategory = !category || item.category === category
      const matchesStudent = !studentId || item.studentId === studentId
      const matchesStartDate = !startDate || item.date >= startDate
      const matchesEndDate = !endDate || item.date <= endDate

      return (
        matchesSearch &&
        matchesDiscipline &&
        matchesStyle &&
        matchesDistance &&
        matchesCompetition &&
        matchesCompetitionType &&
        matchesCourseType &&
        matchesEventFormat &&
        matchesResultStatus &&
        matchesCategory &&
        matchesStudent &&
        matchesStartDate &&
        matchesEndDate
      )
    })

    return paginateItems(filteredItems, params)
  }

  async create(input: CreateResultRepositoryInput): Promise<Result> {
    const result = makeResult({
      studentId: input.studentId,
      discipline: input.discipline ?? 'Piscina',
      style: input.style,
      distance: input.distance,
      customDistance: input.customDistance ?? '',
      competitionType: input.competitionType ?? '',
      courseType: input.courseType ?? '',
      eventFormat: input.eventFormat ?? 'Prova Individual',
      time: input.time,
      date: input.date,
      competition: input.competition ?? '',
      position: input.position ?? 0,
      resultStatus: input.resultStatus ?? 'Classificado',
      category: input.category ?? '',
      notes: input.notes ?? '',
    })

    this.items.push(result)
    return result
  }

  async update(id: string, input: UpdateResultRepositoryInput): Promise<Result> {
    const itemIndex = this.items.findIndex((item) => item.id === id)

    if (itemIndex < 0) {
      throw new AppError(404, 'Result not found')
    }

    const updatedResult: Result = {
      ...this.items[itemIndex],
      studentId: input.studentId,
      discipline: input.discipline ?? 'Piscina',
      style: input.style,
      distance: input.distance,
      customDistance: input.customDistance ?? '',
      competitionType: input.competitionType ?? '',
      courseType: input.courseType ?? '',
      eventFormat: input.eventFormat ?? 'Prova Individual',
      time: input.time,
      timeInSeconds: input.timeInSeconds,
      date: input.date,
      competition: input.competition ?? '',
      position: input.position ?? 0,
      resultStatus: input.resultStatus ?? 'Classificado',
      personalBest: input.personalBest,
      improvement: input.improvement,
      category: input.category ?? '',
      notes: input.notes ?? '',
    }

    this.items[itemIndex] = updatedResult
    return updatedResult
  }

  async remove(id: string): Promise<Result> {
    const itemIndex = this.items.findIndex((item) => item.id === id)

    if (itemIndex < 0) {
      throw new AppError(404, 'Result not found')
    }

    const [removedResult] = this.items.splice(itemIndex, 1)
    return removedResult
  }
}
