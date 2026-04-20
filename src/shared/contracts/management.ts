import { z } from 'zod';
import { isValidDurationString } from '@/shared/utils/duration';
import { normalizeWeekday, weekdayValues } from './weekdays';

export const studentGenderValues = ["Masculino", "Feminino"] as const;
export const resultStyleValues = ["Livre", "Costas", "Peito", "Borboleta", "Medley"] as const;
export const resultDistancePattern = /^\d+(?:[.,]\d+)?(?:m|km)$/i;
export const resultDisciplineValues = ["Piscina", "Aguas Abertas"] as const;
export const resultPoolCourseTypeValues = ["Piscina Curta", "Piscina Longa"] as const;
export const resultOpenWaterCourseTypeValues = ["Mar", "Rio", "Lago", "Represa"] as const;
export const resultCourseTypeValues = [...resultPoolCourseTypeValues, ...resultOpenWaterCourseTypeValues] as const;
export const resultEventFormatValues = ["Prova Individual", "Revezamento", "Travessia", "Knockout Sprint", "Ultramaratona"] as const;
export const resultStatusValues = ["Classificado", "Desclassificado"] as const;
export const trainingVenueTypeValues = ["Piscina", "Mar", "Represa"] as const;
export const exStudentExitReasonValues = [
  "Mudança de cidade",
  "Falta de tempo",
  "Interesse por outro esporte",
  "Idade limite da categoria",
  "Motivos financeiros",
  "Motivos de saúde",
  "Outro",
] as const;

const resultDistanceSchema = z.string().trim().regex(resultDistancePattern, "Invalid distance format");
const optionalResultDistanceSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || resultDistancePattern.test(value), "Invalid distance format");
const resultTimeSchema = z
  .string()
  .trim()
  .min(1, "Invalid time format")
  .refine(isValidDurationString, "Invalid time format");

const weekdaySchema = z
  .string()
  .trim()
  .transform((value) => normalizeWeekday(value) ?? value)
  .pipe(z.enum(weekdayValues));

const applyResultConsistencyRules = (
  data: {
    discipline: (typeof resultDisciplineValues)[number];
    competitionType: (typeof resultDisciplineValues)[number];
    courseType: (typeof resultCourseTypeValues)[number] | "";
    eventFormat: (typeof resultEventFormatValues)[number];
    customDistance?: string;
    resultStatus: (typeof resultStatusValues)[number];
    position?: number;
  },
  ctx: z.RefinementCtx,
) => {
  if (data.competitionType !== data.discipline) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["competitionType"],
      message: "Competition type must match discipline",
    });
  }

  if (data.discipline === "Piscina") {
    if (
      data.courseType &&
      !resultPoolCourseTypeValues.includes(
        data.courseType as (typeof resultPoolCourseTypeValues)[number],
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["courseType"],
        message: "Invalid pool course type",
      });
    }

    if (!["Prova Individual", "Revezamento"].includes(data.eventFormat)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["eventFormat"],
        message: "Invalid pool event format",
      });
    }

    if ((data.customDistance || "").trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customDistance"],
        message: "Pool results must use official distance options only",
      });
    }
  }

  if (data.discipline === "Aguas Abertas") {
    if (
      data.courseType &&
      !resultOpenWaterCourseTypeValues.includes(
        data.courseType as (typeof resultOpenWaterCourseTypeValues)[number],
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["courseType"],
        message: "Invalid open water course type",
      });
    }
  }

  if (data.resultStatus === "Desclassificado" && (data.position ?? 0) > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["position"],
      message: "Disqualified results cannot keep a finishing position",
    });
  }
};

export const classScheduleSchema = z.object({
  dayOfWeek: weekdaySchema,
  startTime: z.string().min(1),
  endTime: z.string().min(1),
});

export const classTeacherSchema = z.object({
  teacherId: z.string().uuid(),
  role: z.enum(["head_coach", "assistant_coach"]),
});

export const createStudentSchema = z.object({
  name: z.string().min(3),
  gender: z.enum(studentGenderValues),
  birthDate: z.string().min(1),
  level: z.string().min(1),
  parentId: z.string().uuid().optional().nullable(),
  classId: z.string().uuid().optional().nullable(),
  phone: z.string().min(1),
  status: z.string().min(1),
  photo: z.string().optional().nullable(),
});

export const updateStudentSchema = createStudentSchema.partial().extend({
  name: z.string().min(3),
  gender: z.enum(studentGenderValues),
  birthDate: z.string().min(1),
  level: z.string().min(1),
  phone: z.string().min(1),
  status: z.string().min(1),
});

export const createTeacherSchema = z.object({
  name: z.string().min(3),
  cpf: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  email: z.string().email(),
  phone: z.string().min(1),
  photo: z.string().optional().nullable(),
  specialities: z.array(z.string().min(1)).min(1),
  categories: z.array(z.string().min(1)).min(1),
  experience: z.string().min(1),
  certifications: z.string().optional().default(""),
  status: z.string().min(1),
  bio: z.string().optional().nullable(),
});

export const updateTeacherSchema = createTeacherSchema.partial().extend({
  name: z.string().min(3),
  email: z.string().email(),
  phone: z.string().min(1),
  specialities: z.array(z.string().min(1)).min(1),
  categories: z.array(z.string().min(1)).min(1),
  experience: z.string().min(1),
  status: z.string().min(1),
});

export const createParentSchema = z.object({
  name: z.string().min(3),
  cpf: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  photo: z.string().optional().nullable(),
  childrenIds: z.array(z.string().uuid()).default([]),
  email: z.string().email(),
  phone: z.string().min(1),
  profession: z.string().min(1),
  address: z.string().min(1),
  emergencyContact: z.string().min(1),
  emergencyPhone: z.string().min(1),
  status: z.enum(["Ativo", "Inativo"]),
});

export const updateParentSchema = createParentSchema.partial().extend({
  name: z.string().min(3),
  childrenIds: z.array(z.string().uuid()).default([]),
  email: z.string().email(),
  phone: z.string().min(1),
  profession: z.string().min(1),
  address: z.string().min(1),
  emergencyContact: z.string().min(1),
  emergencyPhone: z.string().min(1),
  status: z.enum(["Ativo", "Inativo"]),
});

export const createClassSchema = z.object({
  name: z.string().min(3),
  categories: z.array(z.string().min(1)).min(1),
  schedules: z.array(classScheduleSchema).min(1),
  classTeachers: z.array(classTeacherSchema).default([]),
  maxStudents: z.number().int().min(1),
  poolId: z.string().uuid().nullable().optional(),
  status: z.enum(["Ativa", "Pausada", "Encerrada"]),
});

export const updateClassSchema = createClassSchema.extend({
  categoryIds: z.array(z.string().uuid()).optional(),
});

export const transferTeacherSchema = z.object({
  teacherId: z.string().uuid(),
  fromClassId: z.string().uuid(),
  toClassId: z.string().uuid(),
});

export const transferStudentSchema = z.object({
  studentId: z.string().uuid(),
  fromClassId: z.string().uuid(),
  toClassId: z.string().uuid(),
});

export const assignClassTeacherSchema = z.object({
  teacherId: z.string().uuid(),
  role: z.enum(["head_coach", "assistant_coach"]).optional().default("assistant_coach"),
});

export const updateClassTeacherRoleSchema = z.object({
  role: z.enum(["head_coach", "assistant_coach"]),
});

export const attendanceRecordSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  date: z.string().min(1),
  status: z.enum(["present", "absent", "late", "justified"]),
  observations: z.string().optional().default(""),
  savedAt: z.string().optional(),
});

export const saveAttendanceBatchSchema = z.object({
  records: z.array(attendanceRecordSchema).min(1),
});

const resultBaseSchema = z.object({
  studentId: z.string().uuid(),
  studentName: z.string().optional(),
  discipline: z.enum(resultDisciplineValues).optional().default("Piscina"),
  style: z.enum(resultStyleValues),
  distance: resultDistanceSchema,
  customDistance: optionalResultDistanceSchema.optional().default(""),
  competitionType: z.enum(resultDisciplineValues).optional().default("Piscina"),
  courseType: z.union([z.enum(resultCourseTypeValues), z.literal("")]).optional().default(""),
  eventFormat: z.enum(resultEventFormatValues).optional().default("Prova Individual"),
  time: resultTimeSchema,
  date: z.string().min(1),
  competition: z.string().optional().default(""),
  position: z.number().int().min(0).optional().default(0),
  resultStatus: z.enum(resultStatusValues).optional().default("Classificado"),
  category: z.string().optional().default(""),
  notes: z.string().optional(),
});

export const createResultSchema = resultBaseSchema.superRefine(applyResultConsistencyRules);

export const updateResultSchema = resultBaseSchema
  .extend({
    personalBest: z.boolean().default(false),
    improvement: z.number().default(0),
  })
  .superRefine(applyResultConsistencyRules);

export const resultsRankingQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    perPage: z.coerce.number().int().min(1).max(100).optional().default(20),
    discipline: z.enum(resultDisciplineValues),
    competitionType: z.enum(resultDisciplineValues),
    courseType: z
      .union([z.enum(resultCourseTypeValues), z.literal("")])
      .optional()
      .default(""),
    style: z.enum(resultStyleValues),
    distance: resultDistanceSchema,
    customDistance: optionalResultDistanceSchema.optional().default(""),
    eventFormat: z.enum(resultEventFormatValues),
    category: z.string().trim().min(1),
  })
  .superRefine((data, ctx) =>
    applyResultConsistencyRules(
      {
        discipline: data.discipline,
        competitionType: data.competitionType,
        courseType: data.courseType,
        eventFormat: data.eventFormat,
        customDistance: data.customDistance,
        resultStatus: "Classificado",
        position: 0,
      },
      ctx,
    ),
  );

export const createEventSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional().default(""),
  type: z.enum(["Competição", "Reunião", "Festival"]),
  date: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  location: z.string().min(1),
  status: z.enum(["Agendado", "Em Andamento", "Concluído", "Cancelado"]),
});

export const updateEventSchema = createEventSchema;

export const createPoolSchema = z.object({
  name: z.string().min(3),
  lengthMeters: z.number().int().positive(),
  address: z.string().min(1),
  status: z.enum(["Ativa", "Inativa", "Manutenção"]),
  maxCapacity: z.number().int().positive().nullable().optional(),
});

export const updatePoolSchema = createPoolSchema;

export const createTrainingSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional().default(""),
  type: z.enum(["Técnico", "Resistência", "Velocidade", "Misto"]),
  venueType: z.enum(trainingVenueTypeValues),
  locationName: z.string().trim().max(120).optional().default(""),
  dayOfWeek: weekdaySchema,
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  instructorId: z.string().uuid().nullable().optional(),
  level: z.enum(["Iniciante", "Intermediário", "Avançado", "Todos"]),
  maxParticipants: z.number().int().min(0),
  currentParticipants: z.number().int().min(0),
  status: z.enum(["Ativo", "Pausado", "Encerrado"]),
  poolId: z.string().uuid().nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.startTime >= data.endTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endTime"],
      message: "End time must be after start time",
    });
  }

  if (data.venueType === "Piscina") {
    if (!data.poolId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["poolId"],
        message: "Pool trainings must keep a linked pool",
      });
    }
    return;
  }

  if (!data.locationName.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["locationName"],
      message: "Outdoor trainings must include a location name",
    });
  }

  if (data.poolId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["poolId"],
      message: "Outdoor trainings cannot keep a linked pool",
    });
  }
});

export const updateTrainingSchema = createTrainingSchema;

export const createExStudentSchema = z.object({
  studentId: z.string().uuid(),
  exitDate: z.string().min(1),
  exitReason: z.enum(exStudentExitReasonValues),
  exitNotes: z.string().optional(),
  lastCompetition: z.string().optional(),
});

export const updateExStudentSchema = z.object({
  exitDate: z.string().min(1),
  exitReason: z.enum(exStudentExitReasonValues),
  exitNotes: z.string().optional(),
  achievements: z.number().int().min(0),
  lastCompetition: z.string(),
});

export const reactivateExStudentSchema = z.object({
  id: z.string().uuid(),
});

export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(1).optional(),
    avatarUrl: z.string().trim().url().nullable().optional(),
  })
  .refine((data) => data.fullName !== undefined || data.avatarUrl !== undefined, {
    message: "At least one profile field must be provided",
  });

export type CreateStudentDto = z.infer<typeof createStudentSchema>;
export type UpdateStudentDto = z.infer<typeof updateStudentSchema>;
export type CreateTeacherDto = z.infer<typeof createTeacherSchema>;
export type UpdateTeacherDto = z.infer<typeof updateTeacherSchema>;
export type CreateParentDto = z.infer<typeof createParentSchema>;
export type UpdateParentDto = z.infer<typeof updateParentSchema>;
export type CreateClassDto = z.infer<typeof createClassSchema>;
export type UpdateClassDto = z.infer<typeof updateClassSchema>;
export type TransferTeacherDto = z.infer<typeof transferTeacherSchema>;
export type TransferStudentDto = z.infer<typeof transferStudentSchema>;
export type AssignClassTeacherDto = z.infer<typeof assignClassTeacherSchema>;
export type UpdateClassTeacherRoleDto = z.infer<typeof updateClassTeacherRoleSchema>;
export type SaveAttendanceBatchDto = z.infer<typeof saveAttendanceBatchSchema>;
export type CreateResultDto = z.infer<typeof createResultSchema>;
export type UpdateResultDto = z.infer<typeof updateResultSchema>;
export type ResultsRankingQueryDto = z.infer<typeof resultsRankingQuerySchema>;
export type CreateEventDto = z.infer<typeof createEventSchema>;
export type UpdateEventDto = z.infer<typeof updateEventSchema>;
export type CreatePoolDto = z.infer<typeof createPoolSchema>;
export type UpdatePoolDto = z.infer<typeof updatePoolSchema>;
export type CreateTrainingDto = z.infer<typeof createTrainingSchema>;
export type UpdateTrainingDto = z.infer<typeof updateTrainingSchema>;
export type CreateExStudentDto = z.infer<typeof createExStudentSchema>;
export type UpdateExStudentDto = z.infer<typeof updateExStudentSchema>;
export type ReactivateExStudentDto = z.infer<typeof reactivateExStudentSchema>;
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;





