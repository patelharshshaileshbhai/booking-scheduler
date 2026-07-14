const SLOT_MINUTES = 30;

type Slot = {
  startTime: string;
  endTime: string;
};

function isValidDateInput(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTimeInput(value: unknown): value is string {
  return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value);
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function toUtcDate(value: unknown): Date | null {
  if (!isValidDateInput(value)) {
    return null;
  }

  return new Date(`${value}T00:00:00.000Z`);
}

function formatDateKey(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function buildSlots(startTime: string, endTime: string, stepMinutes = SLOT_MINUTES): Slot[] {
  if (!isValidTimeInput(startTime) || !isValidTimeInput(endTime)) {
    return [];
  }

  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (end <= start) {
    return [];
  }

  // Emit fixed 30-minute chips so the public booking UI can render a stable list.
  const slots: Slot[] = [];
  for (let current = start; current + stepMinutes <= end; current += stepMinutes) {
    slots.push({
      startTime: minutesToTime(current),
      endTime: minutesToTime(current + stepMinutes),
    });
  }

  return slots;
}

function ensureSlotAlignment(startTime: unknown, endTime: unknown, slotMinutes = SLOT_MINUTES): boolean {
  if (!isValidTimeInput(startTime) || !isValidTimeInput(endTime)) {
    return false;
  }

  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return end > start && end - start === slotMinutes;
}

export {
  SLOT_MINUTES,
  isValidDateInput,
  isValidTimeInput,
  timeToMinutes,
  minutesToTime,
  toUtcDate,
  formatDateKey,
  buildSlots,
  ensureSlotAlignment,
};