import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { BookingSlot } from '../types';

export default function BookingPage() {
  const { token } = useParams();
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading');
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<BookingSlot | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;

    // Resolve the public link first so invalid tokens can surface a real 404 state.
    api.booking
      .resolve(token)
      .then(() => api.booking.calendar(token))
      .then((response) => {
        if (!mounted) {
          return;
        }
        setDates(response.dates);
        setSelectedDate(response.dates[0] || '');
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (!mounted) {
          return;
        }
        const message = err instanceof Error ? err.message : 'Unknown error';
        setStatus(message === 'Booking link not found.' ? 'not-found' : 'error');
        setError(message);
      });

    return () => {
      mounted = false;
    };
  }, [token]);

  useEffect(() => {
    if (!selectedDate || status !== 'ready') {
      return;
    }

    let mounted = true;
    api.booking
      .slots(token, selectedDate)
      .then((response) => {
        if (mounted) {
          setSlots(response.slots);
          setSelectedSlot(response.slots[0] || null);
        }
      })
      .catch((err: unknown) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load slots.');
        }
      });

    return () => {
      mounted = false;
    };
  }, [selectedDate, status, token]);

  const canBook = useMemo(() => Boolean(selectedSlot && name.trim()), [selectedSlot, name]);

  async function handleBook(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      if (!selectedSlot) {
        throw new Error('Choose a time slot first.');
      }

      const response = await api.booking.book(token, {
        date: selectedDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        bookedBy: name,
      });

      setMessage(`Booked successfully: ${response.booking.startTime} - ${response.booking.endTime}`);
      // Re-fetch the slot list so the UI immediately hides the newly booked time.
      const refreshed = await api.booking.slots(token, selectedDate);
      setSlots(refreshed.slots);
      setSelectedSlot(refreshed.slots[0] || null);
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Booking failed.');
    }
  }

  if (status === 'loading') {
    return <div className="page-center">Loading booking link...</div>;
  }

  if (status === 'not-found') {
    return (
      <div className="page-center error-screen">
        <h1>404</h1>
        <p>{error || 'Booking link not found.'}</p>
      </div>
    );
  }

  if (status === 'error') {
    return <div className="page-center">{error}</div>;
  }

  return (
    <div className="booking-page">
      <div className="booking-hero">
        <p className="eyebrow">Public booking link</p>
        <h1>Choose an open time</h1>
        <p className="subtitle">Future dates only. Booked slots stay hidden for this link.</p>
      </div>

      <section className="panel">
        <h2>Select date</h2>
        <div className="date-grid">
          {dates.map((date) => (
            <button
              key={date}
              type="button"
              className={date === selectedDate ? 'date-pill active' : 'date-pill'}
              onClick={() => setSelectedDate(date)}
            >
              {date}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Available slots</h2>
        <div className="chip-row">
          {slots.length ? (
            slots.map((slot) => (
              <button
                key={`${slot.startTime}-${slot.endTime}`}
                type="button"
                className={
                  selectedSlot?.startTime === slot.startTime && selectedSlot?.endTime === slot.endTime
                    ? 'time-chip active'
                    : 'time-chip'
                }
                onClick={() => setSelectedSlot(slot)}
              >
                {slot.startTime} - {slot.endTime}
              </button>
            ))
          ) : (
            <p className="muted">No slots remain for this date.</p>
          )}
        </div>
      </section>

      <section className="panel">
        <h2>Book this time</h2>
        <form className="form-grid" onSubmit={handleBook}>
          <label>
            Your name
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <div className="summary-card">
            <span>Selected</span>
            <strong>
              {selectedDate || 'No date'} {selectedSlot ? `${selectedSlot.startTime} - ${selectedSlot.endTime}` : ''}
            </strong>
          </div>
          <button className="primary-button" type="submit" disabled={!canBook}>
            Book
          </button>
        </form>
        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="success-text">{message}</p> : null}
      </section>
    </div>
  );
}