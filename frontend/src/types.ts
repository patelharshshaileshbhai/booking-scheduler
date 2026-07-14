export type User = {
  id: string;
  email: string;
  createdAt?: string;
};

export type Availability = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
};

export type BookingSlot = {
  startTime: string;
  endTime: string;
};

export type BookingLink = {
  id: string;
  ownerId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  bookingUrl: string;
};

export type AuthResponse = {
  user: User;
  token: string;
};

export type ApiErrorPayload = {
  error?: string;
  errors?: string[];
};