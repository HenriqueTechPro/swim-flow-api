export const weekdayValues = [
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
  'Domingo',
] as const;

export type Weekday = (typeof weekdayValues)[number];

const weekdayAliases: Record<string, Weekday> = {
  segunda: 'Segunda-feira',
  'segunda-feira': 'Segunda-feira',
  terca: 'Terça-feira',
  'terca-feira': 'Terça-feira',
  'terça': 'Terça-feira',
  'terça-feira': 'Terça-feira',
  quarta: 'Quarta-feira',
  'quarta-feira': 'Quarta-feira',
  quinta: 'Quinta-feira',
  'quinta-feira': 'Quinta-feira',
  sexta: 'Sexta-feira',
  'sexta-feira': 'Sexta-feira',
  sabado: 'Sábado',
  sábado: 'Sábado',
  domingo: 'Domingo',
};

const weekdayShortLabels: Record<Weekday, string> = {
  'Segunda-feira': 'SEG',
  'Terça-feira': 'TER',
  'Quarta-feira': 'QUA',
  'Quinta-feira': 'QUI',
  'Sexta-feira': 'SEX',
  'Sábado': 'SÁB',
  Domingo: 'DOM',
};

const toWeekdayKey = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export const normalizeWeekday = (value?: string | null): Weekday | undefined => {
  if (!value) return undefined;
  return weekdayAliases[toWeekdayKey(value)];
};

export const getWeekdaySortIndex = (value?: string | null) => {
  const weekday = normalizeWeekday(value);
  return weekday ? weekdayValues.indexOf(weekday) : Number.MAX_SAFE_INTEGER;
};

export const getWeekdayShortLabel = (value?: string | null) => {
  const weekday = normalizeWeekday(value);
  return weekday ? weekdayShortLabels[weekday] : value?.slice(0, 3) ?? '';
};

export const getWeekdayLegacyVariants = (value?: string | null) => {
  const weekday = normalizeWeekday(value);
  if (!weekday) return value ? [value] : [];

  const variants = new Set<Weekday | string>([weekday]);

  switch (weekday) {
    case 'Segunda-feira':
      variants.add('Segunda');
      break;
    case 'Terça-feira':
      variants.add('Terca');
      variants.add('Terca-feira');
      break;
    case 'Quarta-feira':
      variants.add('Quarta');
      break;
    case 'Quinta-feira':
      variants.add('Quinta');
      break;
    case 'Sexta-feira':
      variants.add('Sexta');
      break;
    case 'Sábado':
      variants.add('Sabado');
      break;
    default:
      break;
  }

  return Array.from(variants);
};
