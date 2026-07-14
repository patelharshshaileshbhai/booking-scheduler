import { useMemo, useState } from 'react';
import Shell from '../components/Shell';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import type { Availability } from '../types';

const initialForm = {
  date: '',
  startTime: '',
  endTime: '',
};

export default function DashboardPage() {
  const { token, user, logout } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [generatedLink, setGeneratedLink] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const stats = useMemo(() => ({ slots: availability.length }), [availability.length]);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSaving(true);

    try {
      if (!form.date || !form.startTime || !form.endTime) {
        throw new Error('Pick a date, start time, and end time.');
      }

      if (form.endTime <= form.startTime) {
        throw new Error('End time must be after start time.');
      }

      const response = await api.availability.create(token, form);
      setAvailability((current) => [response.availability, ...current]);
      setForm(initialForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save availability.');
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateLink() {
    setError('');
    try {
      const response = await api.links.generate(token);
      setGeneratedLink(response.link.bookingUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate link.');
    }
  }

  return (
    <Shell
      title={`Welcome, ${user?.email || 'member'}`}
      subtitle="Create availability once, keep the list in memory, and publish a booking link for visitors."
      actions={
        <>
          <div className="stat-card">
            <span>Saved slots</span>
            <strong>{stats.slots}</strong>
          </div>
          <button className="ghost-button" onClick={logout} type="button">
            Log out
          </button>
        </>
      }
    >
      <section className="panel">
        <h2>Availability</h2>
        <p>Select a date and a time range, then save it to the backend.</p>
        <form className="form-grid" onSubmit={handleSave}>
          <label>
            Date
            <input
              type="date"
              value={form.date}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
              required
            />
          </label>
          <label>
            Start time
            <input
              type="time"
              value={form.startTime}
              onChange={(event) => setForm({ ...form, startTime: event.target.value })}
              required
            />
          </label>
          <label>
            End time
            <input
              type="time"
              value={form.endTime}
              onChange={(event) => setForm({ ...form, endTime: event.target.value })}
              required
            />
          </label>
          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save availability'}
            </button>
            <button className="secondary-button" type="button" onClick={handleGenerateLink}>
              Generate link
            </button>
          </div>
        </form>
        {error ? <p className="error-text">{error}</p> : null}
        {generatedLink ? (
          <div className="success-card">
            <span>Booking link</span>
            <a href={generatedLink} target="_blank" rel="noreferrer">
              {generatedLink}
            </a>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2>Saved locally from the save response</h2>
        <p>This list is state-only. Refresh the page and it clears, as requested.</p>
        <div className="chip-row">
          {availability.length ? (
            availability.map((item) => (
              <article className="availability-chip" key={item.id}>
                <strong>{item.date.slice(0, 10)}</strong>
                <span>
                  {item.startTime} - {item.endTime}
                </span>
              </article>
            ))
          ) : (
            <p className="muted">No saved availability yet.</p>
          )}
        </div>
      </section>
    </Shell>
  );
}