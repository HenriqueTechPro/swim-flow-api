export interface AttendanceRecord {
  id?: string
  studentId: string
  classId: string
  date: string
  status: 'present' | 'absent' | 'late' | 'justified'
  observations?: string
  savedAt?: string
}
