export interface Event {
  id: string;
  seasonId?: string | null;
  title: string;
  description: string;
  type: 'Competição' | 'Reunião' | 'Festival';
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  status: 'Agendado' | 'Em Andamento' | 'Concluído' | 'Cancelado';
}
