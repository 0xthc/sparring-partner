import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { supabase } from './supabase'

const TABS = ['Precognition', 'Flow', 'Network', 'Terrain']
const STATUS_ORDER = ['To reach', 'Reached out', 'Replied', 'Meeting', 'Following up', 'Pass']
const ALL_FILTERS = ['All', ...STATUS_ORDER]
const STAGE_OPTIONS = ['Pre-seed', 'Seed', 'Series A', 'Growth']
const STATUS_OPTIONS = STATUS_ORDER
const PRIORITY_OPTIONS = [
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'med' },
  { label: 'Low', value: 'low' },
]
const CONTACT_TYPE_OPTIONS = ['Investor', 'Founder', 'Operator', 'Met at event', 'Intro']
const TERRAIN_STATUS_OPTIONS = ['Going', 'Maybe', 'Pass']
const TERRAIN_FILTERS = [
  'All',
  ...TERRAIN_STATUS_OPTIONS,
  'Conference',
  'Dinner',
  'Demo Day',
  'Community',
]
const EVENT_TYPE_OPTIONS = ['Conference', 'Dinner', 'Demo Day', 'Community', 'Happy Hour', 'Other']

const initialForm = {
  name: '',
  title: '',
  fund: '',
  type: 'Investor',
  stage: '',
  how_met: '',
  last_contact: '',
  status: 'To reach',
  priority: 'med',
  notes: '',
}

const initialEventForm = {
  name: '',
  date: '',
  location: '',
  host: '',
  type: 'Conference',
  status: 'Maybe',
  goal: '',
  notes: '',
  source_url: '',
}

const initialFieldNoteForm = {
  name: '',
  fund: '',
  title: '',
  insight: '',
  followUp: '',
  notes: '',
}

function App() {
  const [activeTab, setActiveTab] = useState('Precognition')

  return (
    <div className="app-shell">
      <nav className="top-nav">
        <div className="brand">Sparring Partner</div>
        <div className="tab-list">
          {TABS.map((tab) => (
            <button
              key={tab}
              className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>
      </nav>

      {activeTab === 'Precognition' && <PrecognitionTab />}
      {activeTab === 'Network' && <OutreachTab />}
      {activeTab === 'Flow' && (
        <PlaceholderTab
          title="Flow"
          subtitle="Coming soon — fund portfolio tracking, investment signals, sector heat maps."
        />
      )}
      {activeTab === 'Terrain' && <TerrainTab />}
    </div>
  )
}

function PrecognitionTab() {
  return (
    <iframe
      className="precog-iframe"
      src="https://0xthc.github.io/yc-scout/"
      title="Precognition"
    />
  )
}

function PlaceholderTab({ title, subtitle }) {
  return (
    <section className="placeholder-tab">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </section>
  )
}

function TerrainTab() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('All')
  const [expandedIds, setExpandedIds] = useState([])
  const [goalEditing, setGoalEditing] = useState({})
  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [eventForm, setEventForm] = useState(initialEventForm)
  const [fieldNoteEvent, setFieldNoteEvent] = useState(null)
  const [fieldNoteForm, setFieldNoteForm] = useState(initialFieldNoteForm)
  const [flashMessage, setFlashMessage] = useState('')
  const [showPast, setShowPast] = useState(false)

  useEffect(() => {
    fetchEvents()
  }, [])

  useEffect(() => {
    if (!flashMessage) return undefined
    const timer = setTimeout(() => setFlashMessage(''), 2500)
    return () => clearTimeout(timer)
  }, [flashMessage])

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const aTime = a.date ? new Date(`${a.date}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER
      const bTime = b.date ? new Date(`${b.date}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER
      return aTime - bTime
    })
  }, [events])

  const today = useMemo(() => startOfDay(new Date()), [])

  const stats = useMemo(() => {
    const nextWeek = addDays(today, 7)
    let upcoming = 0
    let going = 0
    let thisWeek = 0

    for (const event of events) {
      const eventDate = event.date ? startOfDay(new Date(`${event.date}T00:00:00`)) : null
      if (!eventDate) continue

      if ((event.status === 'Going' || event.status === 'Maybe') && eventDate.getTime() >= today.getTime()) {
        upcoming += 1
      }
      if (event.status === 'Going') {
        going += 1
      }
      if (eventDate.getTime() >= today.getTime() && eventDate.getTime() <= nextWeek.getTime()) {
        thisWeek += 1
      }
    }

    return { upcoming, going, thisWeek }
  }, [events, today])

  const filteredEvents = useMemo(() => {
    if (filter === 'All') return sortedEvents
    if (TERRAIN_STATUS_OPTIONS.includes(filter)) {
      return sortedEvents.filter((event) => event.status === filter)
    }
    return sortedEvents.filter((event) => event.type === filter)
  }, [filter, sortedEvents])

  const [upcomingEvents, pastEvents] = useMemo(() => {
    const future = []
    const past = []

    for (const event of filteredEvents) {
      const eventDate = event.date ? startOfDay(new Date(`${event.date}T00:00:00`)) : null
      if (!eventDate || eventDate.getTime() >= today.getTime()) {
        future.push(event)
      } else {
        past.push(event)
      }
    }

    return [future, past]
  }, [filteredEvents, today])

  async function fetchEvents() {
    setLoading(true)
    setError('')

    const { data, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .order('date', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
      setEvents([])
    } else {
      setEvents(data ?? [])
    }

    setLoading(false)
  }

  function openEventModal() {
    setEventForm(initialEventForm)
    setEventModalOpen(true)
  }

  async function saveEvent(event) {
    event.preventDefault()
    if (!eventForm.name.trim()) return

    const payload = {
      name: eventForm.name.trim(),
      date: eventForm.date || null,
      location: eventForm.location.trim() || null,
      host: eventForm.host.trim() || null,
      type: eventForm.type || null,
      status: eventForm.status || 'Maybe',
      goal: eventForm.goal.trim() || null,
      notes: eventForm.notes.trim() || null,
      source_url: eventForm.source_url.trim() || null,
      source: 'manual',
    }

    const { error: insertError } = await supabase.from('events').insert(payload)
    if (insertError) {
      setError(insertError.message)
      return
    }

    setEventModalOpen(false)
    setEventForm(initialEventForm)
    await fetchEvents()
  }

  async function updateEventStatus(eventId, status) {
    const { error: updateError } = await supabase.from('events').update({ status }).eq('id', eventId)
    if (updateError) {
      setError(updateError.message)
      return
    }

    setEvents((prev) => prev.map((event) => (event.id === eventId ? { ...event, status } : event)))
  }

  async function updateEventGoal(eventId, goal) {
    const { error: updateError } = await supabase.from('events').update({ goal: goal || null }).eq('id', eventId)
    if (updateError) {
      setError(updateError.message)
      return
    }

    setEvents((prev) => prev.map((event) => (event.id === eventId ? { ...event, goal } : event)))
  }

  async function updateEventNotes(eventId, notes) {
    const { error: updateError } = await supabase.from('events').update({ notes: notes || null }).eq('id', eventId)
    if (updateError) {
      setError(updateError.message)
      return
    }

    setEvents((prev) => prev.map((event) => (event.id === eventId ? { ...event, notes } : event)))
  }

  function toggleExpanded(eventId) {
    setExpandedIds((prev) =>
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId],
    )
  }

  function openFieldNoteModal(terrainEvent) {
    setFieldNoteEvent(terrainEvent)
    setFieldNoteForm(initialFieldNoteForm)
  }

  async function saveFieldNote(event) {
    event.preventDefault()
    if (!fieldNoteEvent) return

    const meetingDate = fieldNoteEvent.date ? formatIsoAsReadable(fieldNoteEvent.date) : 'unknown date'
    const noteParts = [
      `Met at ${fieldNoteEvent.name} on ${meetingDate}.`,
      `Insight: ${fieldNoteForm.insight.trim() || '—'}.`,
      `Follow-up: ${fieldNoteForm.followUp.trim() || '—'}.`,
    ]

    if (fieldNoteForm.notes.trim()) {
      noteParts.push(`Notes: ${fieldNoteForm.notes.trim()}`)
    }

    const payload = {
      name: fieldNoteForm.name.trim() || 'Unknown',
      title: fieldNoteForm.title.trim() || null,
      fund: fieldNoteForm.fund.trim() || null,
      type: 'Met at event',
      status: 'To reach',
      notes: noteParts.join(' '),
      how_met: fieldNoteEvent.name,
    }

    const { error: insertError } = await supabase.from('contacts').insert(payload)
    if (insertError) {
      setError(insertError.message)
      return
    }

    setFieldNoteEvent(null)
    setFieldNoteForm(initialFieldNoteForm)
    setFlashMessage('Contact added to Network')
  }

  return (
    <section className="outreach-wrap terrain-wrap">
      <div className="outreach-header">
        <h1>Terrain · San Francisco</h1>
        <button className="btn btn-dark" onClick={openEventModal} type="button">
          + Add event
        </button>
      </div>

      <div className="stats-grid terrain-stats-grid">
        <StatCard label="Upcoming events" value={stats.upcoming} />
        <StatCard label="Going" value={stats.going} />
        <StatCard label="This week" value={stats.thisWeek} />
      </div>

      <div className="filter-row">
        {TERRAIN_FILTERS.map((value) => (
          <button
            key={value}
            className={`filter-pill ${filter === value ? 'active' : ''}`}
            onClick={() => setFilter(value)}
            type="button"
          >
            {value}
          </button>
        ))}
      </div>

      {flashMessage && <div className="flash-message">{flashMessage}</div>}

      {loading ? (
        <div className="state-card">Loading...</div>
      ) : error ? (
        <div className="state-card error">{error}</div>
      ) : filteredEvents.length === 0 ? (
        <div className="state-card">No events yet. Add your first one.</div>
      ) : (
        <div className="terrain-list">
          {upcomingEvents.map((terrainEvent) => (
            <TerrainEventCard
              key={terrainEvent.id}
              event={terrainEvent}
              expanded={expandedIds.includes(terrainEvent.id)}
              goalEditing={goalEditing[terrainEvent.id] || false}
              onToggleExpanded={() => toggleExpanded(terrainEvent.id)}
              onSetGoalEditing={(editing) =>
                setGoalEditing((prev) => ({
                  ...prev,
                  [terrainEvent.id]: editing,
                }))
              }
              onUpdateGoal={updateEventGoal}
              onUpdateNotes={updateEventNotes}
              onUpdateStatus={updateEventStatus}
              onAddFieldNote={() => openFieldNoteModal(terrainEvent)}
            />
          ))}

          {pastEvents.length > 0 && (
            <div className="past-events-wrap">
              <button className="past-toggle" onClick={() => setShowPast((prev) => !prev)} type="button">
                {showPast ? 'Hide' : 'Show'} past events ({pastEvents.length})
              </button>
              {showPast &&
                pastEvents.map((terrainEvent) => (
                  <TerrainEventCard
                    key={terrainEvent.id}
                    event={terrainEvent}
                    expanded={expandedIds.includes(terrainEvent.id)}
                    goalEditing={goalEditing[terrainEvent.id] || false}
                    onToggleExpanded={() => toggleExpanded(terrainEvent.id)}
                    onSetGoalEditing={(editing) =>
                      setGoalEditing((prev) => ({
                        ...prev,
                        [terrainEvent.id]: editing,
                      }))
                    }
                    onUpdateGoal={updateEventGoal}
                    onUpdateNotes={updateEventNotes}
                    onUpdateStatus={updateEventStatus}
                    onAddFieldNote={() => openFieldNoteModal(terrainEvent)}
                  />
                ))}
            </div>
          )}
        </div>
      )}

      {eventModalOpen && (
        <AddEventModal
          form={eventForm}
          onCancel={() => setEventModalOpen(false)}
          onChange={setEventForm}
          onSave={saveEvent}
        />
      )}

      {fieldNoteEvent && (
        <FieldNoteModal
          terrainEvent={fieldNoteEvent}
          form={fieldNoteForm}
          onCancel={() => setFieldNoteEvent(null)}
          onChange={setFieldNoteForm}
          onSave={saveFieldNote}
        />
      )}
    </section>
  )
}

function TerrainEventCard({
  event,
  expanded,
  goalEditing,
  onToggleExpanded,
  onSetGoalEditing,
  onUpdateGoal,
  onUpdateNotes,
  onUpdateStatus,
  onAddFieldNote,
}) {
  const [goalDraft, setGoalDraft] = useState(event.goal || '')
  const [notesDraft, setNotesDraft] = useState(event.notes || '')

  useEffect(() => {
    setGoalDraft(event.goal || '')
  }, [event.goal])

  useEffect(() => {
    setNotesDraft(event.notes || '')
  }, [event.notes])

  async function saveGoal() {
    onSetGoalEditing(false)
    await onUpdateGoal(event.id, goalDraft.trim())
  }

  async function saveNotes() {
    await onUpdateNotes(event.id, notesDraft.trim())
  }

  return (
    <article className="terrain-card">
      <button className="terrain-main" onClick={onToggleExpanded} type="button">
        <div className="terrain-date">{formatTerrainDate(event.date)}</div>
        <div className="terrain-main-center">
          <div className="terrain-title-row">
            <strong>{event.name || 'Untitled event'}</strong>
            <span className={`event-type-badge ${eventTypeClass(event.type)}`}>{event.type || 'Other'}</span>
          </div>
          <p>{event.host || 'Host not listed'}</p>
          <small>{event.location || 'Location TBD'}</small>
        </div>
      </button>

      <div className="terrain-side">
        <div className="terrain-status-pills">
          {TERRAIN_STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              className={`status-pill ${statusPillClass(status)} ${event.status === status ? 'active' : ''}`}
              onClick={() => onUpdateStatus(event.id, status)}
              type="button"
            >
              {status}
            </button>
          ))}
        </div>

        <div className="goal-inline">
          <span className="goal-label">Goal</span>
          {goalEditing ? (
            <input
              autoFocus
              type="text"
              value={goalDraft}
              onChange={(inputEvent) => setGoalDraft(inputEvent.target.value)}
              onBlur={saveGoal}
              onKeyDown={(keyboardEvent) => {
                if (keyboardEvent.key === 'Enter') {
                  keyboardEvent.preventDefault()
                  saveGoal()
                }
              }}
            />
          ) : (
            <button className="goal-value" onClick={() => onSetGoalEditing(true)} type="button">
              {event.goal || 'Add goal'}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="terrain-expanded">
          <label>
            Notes
            <textarea
              rows="4"
              value={notesDraft}
              onChange={(inputEvent) => setNotesDraft(inputEvent.target.value)}
              onBlur={saveNotes}
            />
          </label>
          <button className="btn btn-light" onClick={onAddFieldNote} type="button">
            Add field note
          </button>
        </div>
      )}
    </article>
  )
}

function AddEventModal({ form, onCancel, onChange, onSave }) {
  return (
    <div className="modal-overlay" onClick={onCancel} role="presentation">
      <div className="modal-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <h3>Add event</h3>
        <form onSubmit={onSave}>
          <div className="modal-grid">
            <label>
              Name *
              <input
                required
                type="text"
                value={form.name}
                onChange={(event) => onChange((prev) => ({ ...prev, name: event.target.value }))}
              />
            </label>
            <label>
              Date
              <input
                type="date"
                value={form.date}
                onChange={(event) => onChange((prev) => ({ ...prev, date: event.target.value }))}
              />
            </label>
            <label>
              Location
              <input
                type="text"
                value={form.location}
                onChange={(event) => onChange((prev) => ({ ...prev, location: event.target.value }))}
              />
            </label>
            <label>
              Host
              <input
                type="text"
                value={form.host}
                onChange={(event) => onChange((prev) => ({ ...prev, host: event.target.value }))}
              />
            </label>
            <label>
              Type
              <select
                value={form.type}
                onChange={(event) => onChange((prev) => ({ ...prev, type: event.target.value }))}
              >
                {EVENT_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                value={form.status}
                onChange={(event) => onChange((prev) => ({ ...prev, status: event.target.value }))}
              >
                {TERRAIN_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Goal
              <input
                type="text"
                value={form.goal}
                onChange={(event) => onChange((prev) => ({ ...prev, goal: event.target.value }))}
              />
            </label>
            <label>
              Source URL
              <input
                type="url"
                value={form.source_url}
                onChange={(event) => onChange((prev) => ({ ...prev, source_url: event.target.value }))}
              />
            </label>
            <label className="full-width">
              Notes
              <textarea
                rows="4"
                value={form.notes}
                onChange={(event) => onChange((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </label>
          </div>

          <div className="modal-actions">
            <div className="modal-actions-right">
              <button className="btn btn-light" onClick={onCancel} type="button">
                Cancel
              </button>
              <button className="btn btn-dark" type="submit">
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function FieldNoteModal({ terrainEvent, form, onCancel, onChange, onSave }) {
  return (
    <div className="modal-overlay" onClick={onCancel} role="presentation">
      <div className="modal-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <h3>Field Note — {terrainEvent.name}</h3>
        <form onSubmit={onSave}>
          <div className="modal-grid">
            <label>
              Name
              <input
                type="text"
                value={form.name}
                onChange={(event) => onChange((prev) => ({ ...prev, name: event.target.value }))}
              />
            </label>
            <label>
              Fund/Company
              <input
                type="text"
                value={form.fund}
                onChange={(event) => onChange((prev) => ({ ...prev, fund: event.target.value }))}
              />
            </label>
            <label>
              Title
              <input
                type="text"
                value={form.title}
                onChange={(event) => onChange((prev) => ({ ...prev, title: event.target.value }))}
              />
            </label>
            <label className="full-width">
              One insight
              <textarea
                rows="3"
                placeholder="What did you learn?"
                value={form.insight}
                onChange={(event) => onChange((prev) => ({ ...prev, insight: event.target.value }))}
              />
            </label>
            <label className="full-width">
              Follow-up action
              <input
                type="text"
                placeholder="Send intro email, connect on LinkedIn..."
                value={form.followUp}
                onChange={(event) => onChange((prev) => ({ ...prev, followUp: event.target.value }))}
              />
            </label>
            <label className="full-width">
              Notes
              <textarea
                rows="4"
                value={form.notes}
                onChange={(event) => onChange((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </label>
          </div>

          <div className="modal-actions">
            <div className="modal-actions-right">
              <button className="btn btn-light" onClick={onCancel} type="button">
                Cancel
              </button>
              <button className="btn btn-dark" type="submit">
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function OutreachTab() {
  /*
  create table contacts (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    title text,
    fund text,
    stage text,
    type text default 'Investor',
    how_met text,
    last_contact date,
    status text default 'To reach',
    notes text,
    priority text default 'med',
    created_at timestamptz default now()
  );
  */

  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('All')
  const [viewMode, setViewMode] = useState('Table')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(initialForm)

  const filteredContacts = useMemo(() => {
    if (filter === 'All') return contacts
    return contacts.filter((contact) => contact.status === filter)
  }, [contacts, filter])

  const stats = useMemo(() => {
    const total = contacts.length
    const activeConversations = contacts.filter(
      (contact) => contact.status === 'Replied' || contact.status === 'Meeting',
    ).length
    const meetings = contacts.filter((contact) => contact.status === 'Meeting').length

    const numerator = contacts.filter(
      (contact) => contact.status === 'Replied' || contact.status === 'Meeting',
    ).length
    const denominator = contacts.filter(
      (contact) =>
        contact.status === 'Reached out' ||
        contact.status === 'Replied' ||
        contact.status === 'Meeting' ||
        contact.status === 'Following up',
    ).length

    const responseRate = denominator === 0 ? 0 : Math.round((numerator / denominator) * 100)

    return { total, activeConversations, meetings, responseRate }
  }, [contacts])

  useEffect(() => {
    fetchContacts()
  }, [])

  async function fetchContacts() {
    setLoading(true)
    setError('')

    const { data, error: fetchError } = await supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setContacts([])
    } else {
      setContacts(data ?? [])
    }

    setLoading(false)
  }

  function openAddModal() {
    setEditing(null)
    setForm(initialForm)
    setModalOpen(true)
  }

  function openEditModal(contact) {
    setEditing(contact)
    setForm({
      name: contact.name ?? '',
      title: contact.title ?? '',
      fund: contact.fund ?? '',
      type: contact.type ?? 'Investor',
      stage: contact.stage ?? '',
      how_met: contact.how_met ?? '',
      last_contact: contact.last_contact ?? '',
      status: contact.status ?? 'To reach',
      priority: contact.priority ?? 'med',
      notes: contact.notes ?? '',
    })
    setModalOpen(true)
  }

  async function handleSave(event) {
    event.preventDefault()

    if (!form.name.trim()) return

    const payload = {
      name: form.name.trim(),
      title: form.title.trim() || null,
      fund: form.fund.trim() || null,
      type: form.type || 'Investor',
      stage: form.stage || null,
      how_met: form.how_met.trim() || null,
      last_contact: form.last_contact || null,
      status: form.status || 'To reach',
      priority: form.priority || 'med',
      notes: form.notes.trim() || null,
    }

    const query = editing
      ? supabase.from('contacts').update(payload).eq('id', editing.id)
      : supabase.from('contacts').insert(payload)

    const { error: saveError } = await query

    if (saveError) {
      setError(saveError.message)
      return
    }

    setModalOpen(false)
    setEditing(null)
    setForm(initialForm)
    await fetchContacts()
  }

  async function handleDelete() {
    if (!editing) return

    const { error: deleteError } = await supabase.from('contacts').delete().eq('id', editing.id)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setModalOpen(false)
    setEditing(null)
    setForm(initialForm)
    await fetchContacts()
  }

  return (
    <section className="outreach-wrap">
      <div className="outreach-header">
        <h1>Network · San Francisco</h1>
        <div className="header-actions">
          <div className="view-toggle">
            {['Table', 'Pipeline'].map((mode) => (
              <button
                key={mode}
                className={viewMode === mode ? 'active' : ''}
                onClick={() => setViewMode(mode)}
                type="button"
              >
                {mode}
              </button>
            ))}
          </div>
          <button className="btn btn-light" type="button">
            Import
          </button>
          <button className="btn btn-dark" onClick={openAddModal} type="button">
            + Add contact
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard label="Total contacts" value={stats.total} />
        <StatCard label="Active conversations" value={stats.activeConversations} />
        <StatCard label="Meetings booked" value={stats.meetings} />
        <StatCard label="Response rate" value={`${stats.responseRate}%`} />
      </div>

      <div className="filter-row">
        {ALL_FILTERS.map((status) => (
          <button
            key={status}
            className={`filter-pill ${filter === status ? 'active' : ''}`}
            onClick={() => setFilter(status)}
            type="button"
          >
            {status}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="state-card">Loading...</div>
      ) : error ? (
        <div className="state-card error">{error}</div>
      ) : filteredContacts.length === 0 ? (
        <div className="state-card">No contacts yet. Add your first one.</div>
      ) : viewMode === 'Table' ? (
        <OutreachTable contacts={filteredContacts} onEdit={openEditModal} />
      ) : (
        <PipelineView contacts={filteredContacts} onEdit={openEditModal} />
      )}

      <MessageTemplates />

      {modalOpen && (
        <ContactModal
          editing={editing}
          form={form}
          onCancel={() => setModalOpen(false)}
          onChange={setForm}
          onDelete={handleDelete}
          onSave={handleSave}
        />
      )}
    </section>
  )
}

function StatCard({ label, value }) {
  return (
    <article className="stat-card">
      <p>{label}</p>
      <h2>{value}</h2>
    </article>
  )
}

function OutreachTable({ contacts, onEdit }) {
  return (
    <div className="table-card">
      <table>
        <thead>
          <tr>
            <th>Priority</th>
            <th>Name</th>
            <th>Fund</th>
            <th>Type</th>
            <th>Stage</th>
            <th>How we met</th>
            <th>Last contact</th>
            <th>Status</th>
            <th>Notes</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => (
            <tr key={contact.id}>
              <td>
                <span className={`priority-dot ${priorityClass(contact.priority)}`} />
              </td>
              <td>
                <div className="name-cell">
                  <strong>{contact.name}</strong>
                  <span>{contact.title || '—'}</span>
                </div>
              </td>
              <td>{contact.fund || '—'}</td>
              <td>
                <TypeBadge type={contact.type} />
              </td>
              <td>
                {contact.stage ? (
                  <span className={`stage-badge ${stageClass(contact.stage)}`}>{contact.stage}</span>
                ) : (
                  '—'
                )}
              </td>
              <td>{contact.how_met || '—'}</td>
              <td>
                <span className={`last-contact ${contactAgeClass(contact.last_contact)}`}>
                  {formatDate(contact.last_contact)}
                </span>
              </td>
              <td>
                <StatusBadge status={contact.status} />
              </td>
              <td>
                <div className="notes-cell">{contact.notes || '—'}</div>
              </td>
              <td>
                <button className="icon-btn" onClick={() => onEdit(contact)} type="button" aria-label="Edit contact">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M4 20h4l10.5-10.5a1.4 1.4 0 0 0 0-2L16.5 5.5a1.4 1.4 0 0 0-2 0L4 16v4Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                  </svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PipelineView({ contacts, onEdit }) {
  return (
    <div className="pipeline-wrap">
      {STATUS_ORDER.map((status) => {
        const laneContacts = contacts.filter((contact) => contact.status === status)

        return (
          <div className="pipeline-col" key={status}>
            <div className="pipeline-col-head">
              <StatusBadge status={status} />
              <span>{laneContacts.length}</span>
            </div>
            <div className="pipeline-list">
              {laneContacts.map((contact) => (
                <button className="pipeline-card" key={contact.id} onClick={() => onEdit(contact)} type="button">
                  <strong>{contact.name}</strong>
                  <span>{contact.fund || 'No fund listed'}</span>
                  <p>{contact.notes || 'No notes yet'}</p>
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ContactModal({ editing, form, onCancel, onChange, onDelete, onSave }) {
  return (
    <div className="modal-overlay" onClick={onCancel} role="presentation">
      <div className="modal-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <h3>{editing ? 'Edit contact' : 'Add contact'}</h3>
        <form onSubmit={onSave}>
          <div className="modal-grid">
            <label>
              Name *
              <input
                required
                type="text"
                value={form.name}
                onChange={(event) => onChange((prev) => ({ ...prev, name: event.target.value }))}
              />
            </label>
            <label>
              Title
              <input
                type="text"
                value={form.title}
                onChange={(event) => onChange((prev) => ({ ...prev, title: event.target.value }))}
              />
            </label>
            <label>
              Fund
              <input
                type="text"
                value={form.fund}
                onChange={(event) => onChange((prev) => ({ ...prev, fund: event.target.value }))}
              />
            </label>
            <label>
              Type
              <select
                value={form.type}
                onChange={(event) => onChange((prev) => ({ ...prev, type: event.target.value }))}
              >
                {CONTACT_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Stage
              <select
                value={form.stage}
                onChange={(event) => onChange((prev) => ({ ...prev, stage: event.target.value }))}
              >
                <option value="">Select stage</option>
                {STAGE_OPTIONS.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </label>
            <label>
              How we met
              <input
                type="text"
                value={form.how_met}
                onChange={(event) => onChange((prev) => ({ ...prev, how_met: event.target.value }))}
              />
            </label>
            <label>
              Last contact
              <input
                type="date"
                value={form.last_contact}
                onChange={(event) => onChange((prev) => ({ ...prev, last_contact: event.target.value }))}
              />
            </label>
            <label>
              Status
              <select
                value={form.status}
                onChange={(event) => onChange((prev) => ({ ...prev, status: event.target.value }))}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Priority
              <select
                value={form.priority}
                onChange={(event) => onChange((prev) => ({ ...prev, priority: event.target.value }))}
              >
                {PRIORITY_OPTIONS.map((priority) => (
                  <option key={priority.value} value={priority.value}>
                    {priority.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="full-width">
              Notes
              <textarea
                rows="4"
                value={form.notes}
                onChange={(event) => onChange((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </label>
          </div>

          <div className="modal-actions">
            {editing && (
              <button className="btn btn-danger" onClick={onDelete} type="button">
                Delete
              </button>
            )}
            <div className="modal-actions-right">
              <button className="btn btn-light" onClick={onCancel} type="button">
                Cancel
              </button>
              <button className="btn btn-dark" type="submit">
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function MessageTemplates() {
  const introTemplate =
    'Hi [Name], I recently moved to San Francisco from Paris and I am mapping founder signals across consumer in the US and EU. I built a lightweight Precognition workflow to spot early momentum and would value a quick exchange on what you are seeing at the pre-seed and seed stages.'
  const followUpTemplate =
    'Quick follow-up on a founder signal we discussed: [Founder] is showing strong early pull with [signal]. Happy to send a short brief with market context and adjacent opportunities if useful for your pipeline.'

  async function copyTemplate(text) {
    await navigator.clipboard.writeText(text)
  }

  return (
    <section className="templates-wrap">
      <article className="template-card">
        <h3>Cold intro — scout angle</h3>
        <p>{introTemplate}</p>
        <button className="btn btn-light" onClick={() => copyTemplate(introTemplate)} type="button">
          Copy
        </button>
      </article>
      <article className="template-card">
        <h3>Follow-up — signal share</h3>
        <p>{followUpTemplate}</p>
        <button className="btn btn-light" onClick={() => copyTemplate(followUpTemplate)} type="button">
          Copy
        </button>
      </article>
    </section>
  )
}

function StatusBadge({ status }) {
  const map = {
    'To reach': 'status-to-reach',
    'Reached out': 'status-reached-out',
    Replied: 'status-replied',
    Meeting: 'status-meeting',
    'Following up': 'status-following-up',
    Pass: 'status-pass',
  }

  return (
    <span className={`status-badge ${map[status] || 'status-to-reach'}`}>
      <span className="dot" />
      {status || 'To reach'}
    </span>
  )
}

function TypeBadge({ type }) {
  const map = {
    Investor: 'type-investor',
    Founder: 'type-founder',
    Operator: 'type-operator',
    'Met at event': 'type-met-event',
    Intro: 'type-intro',
  }

  return <span className={`type-badge ${map[type] || 'type-investor'}`}>{type || 'Investor'}</span>
}

function priorityClass(priority) {
  if (priority === 'high') return 'priority-high'
  if (priority === 'low') return 'priority-low'
  return 'priority-med'
}

function stageClass(stage) {
  if (stage === 'Pre-seed') return 'stage-preseed'
  if (stage === 'Seed') return 'stage-seed'
  return ''
}

function contactAgeClass(lastContact) {
  if (!lastContact) return 'age-old'

  const days = daysSince(lastContact)

  if (days <= 7) return 'age-fresh'
  if (days <= 30) return 'age-warm'
  return 'age-old'
}

function eventTypeClass(type) {
  if (type === 'Conference') return 'event-type-conference'
  if (type === 'Dinner') return 'event-type-dinner'
  if (type === 'Demo Day') return 'event-type-demo-day'
  if (type === 'Community') return 'event-type-community'
  if (type === 'Happy Hour') return 'event-type-happy-hour'
  return 'event-type-other'
}

function statusPillClass(status) {
  if (status === 'Going') return 'status-pill-going'
  if (status === 'Maybe') return 'status-pill-maybe'
  return 'status-pill-pass'
}

function formatDate(date) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString()
}

function formatTerrainDate(date) {
  if (!date) return 'TBD'
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatIsoAsReadable(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function daysSince(dateString) {
  const now = new Date()
  const then = new Date(dateString)
  const diff = now.getTime() - then.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

export default App
