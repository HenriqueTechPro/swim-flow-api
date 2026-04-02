export interface SaveAttendanceRecordRequest {
  studentId: string
  classId: string
  date: string
  status: 'present' | 'absent' | 'late' | 'justified'
  observations?: string
  savedAt?: string
}

export interface SaveAttendanceBatchRequest {
  records: SaveAttendanceRecordRequest[]
}
