import './style.css'
import { gsap } from 'gsap'
import { Chart, DoughnutController, ArcElement, Tooltip, Legend, BarController, BarElement, CategoryScale, LinearScale } from 'chart.js'
import Toastify from 'toastify-js'
import 'toastify-js/src/toastify.css'

Chart.register(DoughnutController, ArcElement, Tooltip, Legend, BarController, BarElement, CategoryScale, LinearScale)

const STORAGE_KEY = 'applications'
const DARK_MODE_KEY = 'darkMode'
const VIEW_KEY = 'currentView'
const SORT_KEY = 'sortBy'

const STATUSES = ['Applied', 'In Progress', 'Interview', 'Offer', 'Rejected']
const CATEGORIES = ['Frontend', 'Backend', 'Full Stack', 'Python / Automation', 'AI Integration', 'Other']
const PRIORITIES = ['Low', 'Medium', 'High']

let applications = loadApplications()
let searchTerm = ''
let selectedStatus = 'All'
let selectedCategory = 'All'
let selectedPriority = 'All'
let currentView = localStorage.getItem(VIEW_KEY) || 'list'
let sortBy = localStorage.getItem(SORT_KEY) || 'newest'
let darkMode = localStorage.getItem(DARK_MODE_KEY) === 'true'
let chartInstances = []

const app = document.querySelector('#app')

function loadApplications() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(stored) ? stored.map(normalizeApplication) : []
  } catch {
    return []
  }
}

function normalizeApplication(application) {
  return {
    id: application.id || Date.now() + Math.random(),
    position: application.position || 'Untitled Position',
    company: application.company || 'Unknown Company',
    category: application.category || 'Other',
    priority: application.priority || 'Medium',
    status: application.status || 'Applied',
    date: application.date || new Date().toISOString().slice(0, 10),
    url: application.url || '',
    notes: application.notes || ''
  }
}

function saveApplications() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(applications))
}

function showToast(message, type = 'success') {
  Toastify({
    text: message,
    duration: 2800,
    gravity: 'top',
    position: 'right',
    close: true,
    stopOnFocus: true,
    className: `toast toast-${type}`
  }).showToast()
}

function escapeHTML(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatDate(dateString) {
  if (!dateString) return 'No date'
  const date = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateString
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date)
}

function getStats() {
  const total = applications.length
  const counts = Object.fromEntries(STATUSES.map(status => [status, applications.filter(app => app.status === status).length]))
  const successful = counts.Interview + counts.Offer
  return {
    total,
    ...counts,
    successRate: total ? Math.round((successful / total) * 100) : 0,
    interviewRate: total ? Math.round((counts.Interview / total) * 100) : 0
  }
}

function renderApp() {
  document.body.classList.toggle('dark-mode', darkMode)
  const stats = getStats()

  app.innerHTML = `
    <div class="container">
      <header class="header page-enter">
        <div class="header-top">
          <div class="brand-block">
            <span class="eyebrow">CAREER WORKSPACE</span>
            <h1>Job Application Tracker</h1>
            <p>Manage and track your job applications with clarity.</p>
          </div>
          <button id="themeToggle" class="theme-toggle" aria-label="Toggle dark mode" title="Toggle dark mode">
            ${darkMode ? '☀️' : '🌙'}
          </button>
        </div>
        <button id="addApplicationButton" class="primary-button button-lift">＋ Add Application</button>
      </header>

      <section class="stats page-enter" aria-label="Application statistics">
        ${statCard('Total Applications', stats.total, '📋', 'blue')}
        ${statCard('In Progress', stats['In Progress'], '⏳', 'orange')}
        ${statCard('Interviews', stats.Interview, '💬', 'purple')}
        ${statCard('Offers', stats.Offer, '🎯', 'green')}
      </section>

      <section class="analytics-section page-enter">
        <div class="section-heading">
          <div>
            <span class="section-kicker">PERFORMANCE</span>
            <h2>Application Analytics</h2>
            <p>Overview of your application pipeline and progress.</p>
          </div>
        </div>

        <div class="analytics-grid">
          <div class="analytics-card metric-card">
            <span>Success Rate</span>
            <strong>${stats.successRate}%</strong>
            <small>Interviews + Offers</small>
          </div>
          <div class="analytics-card metric-card">
            <span>Interview Rate</span>
            <strong>${stats.interviewRate}%</strong>
            <small>Applications leading to interviews</small>
          </div>
          <div class="analytics-card metric-card">
            <span>Rejected Applications</span>
            <strong>${stats.Rejected}</strong>
            <small>Applications rejected</small>
          </div>
        </div>

        <div class="charts-grid">
          <div class="chart-card">
            <div class="chart-card-header"><div><h3>Status Distribution</h3><p>Where your applications currently stand.</p></div></div>
            <div class="chart-wrap"><canvas id="statusChart"></canvas></div>
          </div>
          <div class="chart-card">
            <div class="chart-card-header"><div><h3>Pipeline Overview</h3><p>Compare your application stages.</p></div></div>
            <div class="chart-wrap chart-bar-wrap"><canvas id="pipelineChart"></canvas></div>
          </div>
        </div>

        <div class="status-overview">
          <div class="subsection-heading"><h3>Application Status</h3><span>${stats.total} total</span></div>
          ${STATUSES.map(status => createStatusProgress(status, stats[status], stats.total)).join('')}
        </div>
      </section>

      <section class="applications-section page-enter">
        <div class="section-header">
          <div><span class="section-kicker">PIPELINE</span><h2>My Applications</h2></div>
          <div class="data-actions">
            <button id="exportButton" class="secondary-button">⬇ Export Data</button>
            <label class="secondary-button import-button">⬆ Import Data<input type="file" id="importInput" accept=".json" hidden /></label>
          </div>
        </div>

        <div class="view-controls">
          <button id="listViewButton" class="view-button ${currentView === 'list' ? 'active' : ''}">📋 List View</button>
          <button id="kanbanViewButton" class="view-button ${currentView === 'kanban' ? 'active' : ''}">🗂️ Kanban View</button>
        </div>

        <div class="filters">
          <label class="search-field"><span>⌕</span><input type="text" id="searchInput" placeholder="Search by position or company..." value="${escapeHTML(searchTerm)}" /></label>
          <select id="statusFilter"><option value="All">All Statuses</option>${STATUSES.map(option => `<option value="${option}">${option}</option>`).join('')}</select>
          <select id="categoryFilter"><option value="All">All Categories</option>${CATEGORIES.map(option => `<option value="${option}">${option}</option>`).join('')}</select>
          <select id="priorityFilter"><option value="All">All Priorities</option>${PRIORITIES.map(option => `<option value="${option}">${option} Priority</option>`).join('')}</select>
          <select id="sortFilter"><option value="newest">Newest First</option><option value="oldest">Oldest First</option><option value="company-asc">Company A–Z</option><option value="company-desc">Company Z–A</option><option value="priority-high">Highest Priority</option><option value="priority-low">Lowest Priority</option></select>
        </div>

        <div id="applicationsList"></div>
      </section>
    </div>
    <div id="modalRoot"></div>
  `

  document.querySelector('#statusFilter').value = selectedStatus
  document.querySelector('#categoryFilter').value = selectedCategory
  document.querySelector('#priorityFilter').value = selectedPriority
  document.querySelector('#sortFilter').value = sortBy

  attachGlobalEvents()
  updateApplicationsList()
  renderCharts()
  animatePage()
}

function statCard(label, value, icon, tone) {
  return `<div class="stat-card stat-${tone}"><div class="stat-icon">${icon}</div><div><span>${label}</span><strong>${value}</strong></div></div>`
}

function createStatusProgress(status, count, total) {
  const percentage = total ? Math.round((count / total) * 100) : 0
  return `<div class="status-row"><div class="status-row-header"><span><i class="status-dot status-${status.toLowerCase().replaceAll(' ', '-')}"></i>${status}</span><strong>${count}</strong></div><div class="progress-bar"><div class="progress-fill progress-${status.toLowerCase().replaceAll(' ', '-')}" style="width:${percentage}%"></div></div></div>`
}

function getFilteredApplications() {
  const search = searchTerm.trim().toLowerCase()
  const priorityRank = { High: 3, Medium: 2, Low: 1 }

  return applications
    .filter(application => {
      const matchesSearch = !search || `${application.position} ${application.company}`.toLowerCase().includes(search)
      const matchesStatus = selectedStatus === 'All' || application.status === selectedStatus
      const matchesCategory = selectedCategory === 'All' || application.category === selectedCategory
      const matchesPriority = selectedPriority === 'All' || application.priority === selectedPriority
      return matchesSearch && matchesStatus && matchesCategory && matchesPriority
    })
    .sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.date) - new Date(b.date)
      if (sortBy === 'company-asc') return a.company.localeCompare(b.company)
      if (sortBy === 'company-desc') return b.company.localeCompare(a.company)
      if (sortBy === 'priority-high') return priorityRank[b.priority] - priorityRank[a.priority]
      if (sortBy === 'priority-low') return priorityRank[a.priority] - priorityRank[b.priority]
      return new Date(b.date) - new Date(a.date)
    })
}

function updateApplicationsList() {
  const list = document.querySelector('#applicationsList')
  if (!list) return
  const filtered = getFilteredApplications()
  list.innerHTML = currentView === 'kanban' ? renderKanbanView(filtered) : renderListView(filtered)
  attachApplicationEvents()
  animateCards()
}

function renderListView(filtered) {
  if (!filtered.length) return `<div class="empty-state"><div class="empty-icon">🔎</div><h3>No applications found</h3><p>Try changing your search or filters, or add a new application.</p><button class="primary-button" id="emptyAddButton">＋ Add Application</button></div>`
  return `<div class="application-list">${filtered.map(createApplicationCard).join('')}</div>`
}

function renderKanbanView(filtered) {
  return `<div class="kanban-board">${STATUSES.map(status => {
    const statusApps = filtered.filter(application => application.status === status)
    return `<div class="kanban-column"><div class="kanban-column-header"><div><span class="section-kicker">STAGE</span><h3>${status}</h3></div><span class="kanban-count">${statusApps.length}</span></div><div class="kanban-column-content">${statusApps.length ? statusApps.map(createKanbanCard).join('') : '<div class="kanban-empty">No applications</div>'}</div></div>`
  }).join('')}</div>`
}

function createApplicationCard(application) {
  return `<article class="application-card" data-id="${application.id}">
    <div class="card-main">
      <div class="company-avatar">${escapeHTML(application.company.charAt(0).toUpperCase())}</div>
      <div class="card-content">
        <div class="card-title-row"><h3>${escapeHTML(application.position)}</h3><span class="priority-badge priority-${application.priority.toLowerCase()}">${priorityIcon(application.priority)} ${application.priority}</span></div>
        <p class="company-name">${escapeHTML(application.company)}</p>
        <div class="card-meta"><span class="category-badge">${categoryIcon(application.category)} ${escapeHTML(application.category)}</span><span class="date-meta">📅 ${formatDate(application.date)}</span></div>
        ${application.url ? `<a class="job-link" href="${escapeHTML(application.url)}" target="_blank" rel="noopener noreferrer">🔗 View Job Posting <span>↗</span></a>` : ''}
        ${application.notes ? `<div class="notes-preview"><span>📝</span><p>${escapeHTML(application.notes)}</p></div>` : ''}
      </div>
    </div>
    <div class="card-actions"><span class="status-badge status-badge-${application.status.toLowerCase().replaceAll(' ', '-')}">${escapeHTML(application.status)}</span><div class="action-buttons"><button class="edit-button" data-id="${application.id}">Edit</button><button class="delete-button" data-id="${application.id}">Delete</button></div></div>
  </article>`
}

function createKanbanCard(application) {
  return `<article class="kanban-card" data-id="${application.id}"><div class="kanban-card-top"><span class="priority-badge priority-${application.priority.toLowerCase()}">${priorityIcon(application.priority)} ${application.priority}</span><button class="more-button" data-id="${application.id}" aria-label="Edit application">•••</button></div><h4>${escapeHTML(application.position)}</h4><p>${escapeHTML(application.company)}</p><small>📅 ${formatDate(application.date)}</small><div class="kanban-actions"><button class="edit-button" data-id="${application.id}">Edit</button><button class="delete-button" data-id="${application.id}">Delete</button></div></article>`
}

function priorityIcon(priority) {
  return priority === 'High' ? '🔥' : priority === 'Medium' ? '⭐' : '🌱'
}

function categoryIcon(category) {
  return { Frontend: '🎨', Backend: '⚙️', 'Full Stack': '🧩', 'Python / Automation': '🐍', 'AI Integration': '🤖', Other: '💻' }[category] || '💻'
}

function attachGlobalEvents() {
  document.querySelector('#addApplicationButton').addEventListener('click', showApplicationForm)
  document.querySelector('#themeToggle').addEventListener('click', toggleDarkMode)
  document.querySelector('#exportButton').addEventListener('click', exportData)
  document.querySelector('#importInput').addEventListener('change', importData)
  document.querySelector('#listViewButton').addEventListener('click', () => setView('list'))
  document.querySelector('#kanbanViewButton').addEventListener('click', () => setView('kanban'))

  const searchInput = document.querySelector('#searchInput')
  searchInput.addEventListener('input', event => { searchTerm = event.target.value; updateApplicationsList() })
  document.querySelector('#statusFilter').addEventListener('change', event => { selectedStatus = event.target.value; updateApplicationsList() })
  document.querySelector('#categoryFilter').addEventListener('change', event => { selectedCategory = event.target.value; updateApplicationsList() })
  document.querySelector('#priorityFilter').addEventListener('change', event => { selectedPriority = event.target.value; updateApplicationsList() })
  document.querySelector('#sortFilter').addEventListener('change', event => { sortBy = event.target.value; localStorage.setItem(SORT_KEY, sortBy); updateApplicationsList() })

  document.querySelector('#emptyAddButton')?.addEventListener('click', showApplicationForm)
}

function attachApplicationEvents() {
  document.querySelectorAll('.edit-button, .more-button').forEach(button => button.addEventListener('click', () => editApplication(Number(button.dataset.id))))
  document.querySelectorAll('.delete-button').forEach(button => button.addEventListener('click', () => deleteApplication(Number(button.dataset.id))))
}

function setView(view) {
  currentView = view
  localStorage.setItem(VIEW_KEY, view)
  document.querySelectorAll('.view-button').forEach(button => button.classList.remove('active'))
  document.querySelector(view === 'list' ? '#listViewButton' : '#kanbanViewButton').classList.add('active')
  updateApplicationsList()
}

function formMarkup(title, application = null) {
  const value = key => escapeHTML(application?.[key] || '')
  return `<div class="modal-backdrop" id="modalBackdrop"><div class="modal-card" role="dialog" aria-modal="true"><button class="modal-close" id="closeModal">×</button><span class="section-kicker">APPLICATION</span><h2>${title}</h2><p class="modal-subtitle">Keep your job search organized and actionable.</p><form id="applicationForm"><div class="form-grid"><label>Job Position<input type="text" id="position" value="${value('position')}" required placeholder="e.g. Junior Frontend Developer"></label><label>Company<input type="text" id="company" value="${value('company')}" required placeholder="e.g. Spotify"></label><label>Category<select id="category">${CATEGORIES.map(option => `<option ${application?.category === option ? 'selected' : ''}>${option}</option>`).join('')}</select></label><label>Priority<select id="priority">${PRIORITIES.map(option => `<option ${application?.priority === option ? 'selected' : ''}>${option}</option>`).join('')}</select></label><label>Status<select id="status">${STATUSES.map(option => `<option ${application?.status === option ? 'selected' : ''}>${option}</option>`).join('')}</select></label><label>Application Date<input type="date" id="date" value="${value('date') || new Date().toISOString().slice(0, 10)}" required></label><label class="full-width">Job Posting URL<input type="url" id="url" value="${value('url')}" placeholder="https://..."></label><label class="full-width">Notes<textarea id="notes" rows="4" placeholder="Add useful notes about this opportunity...">${value('notes')}</textarea></label></div><div class="form-buttons"><button type="submit" class="primary-button">${application ? 'Save Changes' : 'Add Application'}</button><button type="button" class="secondary-button" id="cancelButton">Cancel</button></div></form></div></div>`
}

function showApplicationForm(application = null) {
  document.querySelector('#modalRoot').innerHTML = formMarkup(application ? 'Edit Application' : 'Add Application', application)
  const backdrop = document.querySelector('#modalBackdrop')
  gsap.fromTo('.modal-card', { y: 24, opacity: 0, scale: 0.97 }, { y: 0, opacity: 1, scale: 1, duration: 0.35, ease: 'power2.out' })
  document.querySelector('#closeModal').addEventListener('click', closeModal)
  document.querySelector('#cancelButton').addEventListener('click', closeModal)
  backdrop.addEventListener('click', event => { if (event.target === backdrop) closeModal() })
  document.querySelector('#applicationForm').addEventListener('submit', event => {
    event.preventDefault()
    const data = Object.fromEntries(new FormData(event.target).entries())
    const payload = normalizeApplication({ ...data, id: application?.id || Date.now() })
    if (application) applications = applications.map(item => item.id === application.id ? payload : item)
    else applications.push(payload)
    saveApplications()
    closeModal()
    renderApp()
    showToast(application ? 'Application updated successfully' : 'Application added successfully')
  })
}

function closeModal() {
  const modal = document.querySelector('#modalBackdrop')
  if (!modal) return
  gsap.to('.modal-card', { y: 16, opacity: 0, duration: 0.2, onComplete: () => { document.querySelector('#modalRoot').innerHTML = '' } })
}

function editApplication(id) {
  const application = applications.find(item => item.id === id)
  if (application) showApplicationForm(application)
}

function deleteApplication(id) {
  const application = applications.find(item => item.id === id)
  if (!application) return
  if (!window.confirm(`Delete the application for ${application.position} at ${application.company}?`)) return
  const card = document.querySelector(`[data-id="${id}"]`)
  gsap.to(card, { x: 60, opacity: 0, height: 0, marginBottom: 0, duration: 0.3, ease: 'power2.in', onComplete: () => {
    applications = applications.filter(item => item.id !== id)
    saveApplications()
    renderApp()
    showToast('Application deleted', 'info')
  } })
}

function toggleDarkMode() {
  darkMode = !darkMode
  localStorage.setItem(DARK_MODE_KEY, String(darkMode))
  renderApp()
  showToast(darkMode ? 'Dark mode enabled' : 'Light mode enabled', 'info')
}

function exportData() {
  const blob = new Blob([JSON.stringify(applications, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `job-applications-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
  showToast('Data exported successfully')
}

function importData(event) {
  const file = event.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result)
      if (!Array.isArray(imported)) throw new Error('Invalid format')
      applications = imported.map(normalizeApplication)
      saveApplications()
      renderApp()
      showToast(`${applications.length} applications imported successfully`)
    } catch {
      showToast('Invalid JSON file', 'error')
    }
    event.target.value = ''
  }
  reader.readAsText(file)
}

function renderCharts() {
  chartInstances.forEach(chart => chart.destroy())
  chartInstances = []
  const stats = getStats()
  const textColor = getComputedStyle(document.body).getPropertyValue('--text-secondary').trim()
  const gridColor = getComputedStyle(document.body).getPropertyValue('--border').trim()
  const statusCanvas = document.querySelector('#statusChart')
  const pipelineCanvas = document.querySelector('#pipelineChart')
  if (!statusCanvas || !pipelineCanvas) return

  chartInstances.push(new Chart(statusCanvas, {
    type: 'doughnut',
    data: { labels: STATUSES, datasets: [{ data: STATUSES.map(status => stats[status]), backgroundColor: ['#2563eb', '#f59e0b', '#7c3aed', '#16a34a', '#dc2626'], borderWidth: 0, hoverOffset: 8 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { color: textColor, usePointStyle: true, padding: 16 } } } }
  }))

  chartInstances.push(new Chart(pipelineCanvas, {
    type: 'bar',
    data: { labels: STATUSES, datasets: [{ label: 'Applications', data: STATUSES.map(status => stats[status]), borderRadius: 8, backgroundColor: ['#2563eb', '#f59e0b', '#7c3aed', '#16a34a', '#dc2626'] }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: textColor } }, y: { beginAtZero: true, ticks: { precision: 0, color: textColor }, grid: { color: gridColor } } } }
  }))
}

function animatePage() {
  gsap.fromTo('.page-enter', { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, stagger: 0.07, ease: 'power2.out' })
}

function animateCards() {
  gsap.fromTo('.application-card, .kanban-card', { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.32, stagger: 0.045, ease: 'power2.out' })
}

document.body.classList.toggle('dark-mode', darkMode)
renderApp()
