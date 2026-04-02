export interface CreateExStudentRequest {
  studentId: string
  exitDate: string
  exitReason: string
  exitNotes?: string
  lastCompetition?: string
}

export interface UpdateExStudentRequest {
  exitDate: string
  exitReason: string
  exitNotes?: string
  achievements: number
  lastCompetition: string
}
