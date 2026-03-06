// Supabase Configuration
// IMPORTANT: These should ideally be environment variables, but for a simple static site 
// without a build step, they are placed here. In a production Netlify environment, 
// you can Use Netlify Snippet Injection to inject these securely.
const SUPABASE_URL = 'https://pavaoqofbedtgpavwycy.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_uhaWt71vljBDHUorkT7fZw_9usp4GT2'

// Initialize Supabase Client - renamed to _supabase to avoid conflict with global 'supabase'
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// DOM Elements
const movieGrid = document.getElementById('movieGrid')
const searchInput = document.getElementById('searchInput')
const openModalBtn = document.getElementById('openModalBtn')
const closeModalBtn = document.getElementById('closeModalBtn')
const cancelBtn = document.getElementById('cancelBtn')
const modalOverlay = document.getElementById('modalOverlay')
const addMovieForm = document.getElementById('addMovieForm')
const loadingState = document.getElementById('loadingState')
const emptyState = document.getElementById('emptyState')

// State
let movies = []
let favorites = []
let watchlist = []

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    fetchInitialData()
    setupEventListeners()
})

async function fetchInitialData() {
    try {
        // Check for file:// protocol which can block requests in some browsers
        if (window.location.protocol === 'file:') {
            console.warn('Running from file:// might block Supabase requests in some browsers. Consider using a local server or deploying to Netlify.');
        }

        showLoading(true)

        // Fetch movies, favorites, and watchlist in parallel
        const [moviesRes, favsRes, watchRes] = await Promise.all([
            _supabase.from('movies').select('*').order('created_at', { ascending: false }),
            _supabase.from('favorites').select('movie_id'),
            _supabase.from('watchlist').select('movie_id')
        ])

        if (moviesRes.error) throw moviesRes.error

        movies = moviesRes.data
        favorites = favsRes.data.map(f => f.movie_id)
        watchlist = watchRes.data.map(w => w.movie_id)

        renderMovies(movies)
    } catch (error) {
        console.error('Error fetching data:', error)
        loadingState.innerHTML = `<p style="color: var(--danger)">Connection Error: ${error.message || 'Check your internet or Supabase configuration.'}</p>`
    } finally {
        // Only hide if we actually loaded something or had an error (handled above)
        if (movies.length > 0 || emptyState.classList.contains('hidden')) {
            showLoading(false)
        }
    }
}

function setupEventListeners() {
    // Search
    let searchTimeout
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout)
        searchTimeout = setTimeout(() => handleSearch(e.target.value), 300)
    })

    // Modal
    openModalBtn.addEventListener('click', () => modalOverlay.classList.remove('hidden'))
    closeModalBtn.addEventListener('click', closeModal)
    cancelBtn.addEventListener('click', closeModal)
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal()
    })

    // Form
    addMovieForm.addEventListener('submit', handleAddMovie)
}

// --- Core Functions ---

async function handleSearch(term) {
    try {
        if (!term.trim()) {
            renderMovies(movies)
            return
        }

        const { data, error } = await _supabase
            .from('movies')
            .select('*')
            .ilike('title', `%${term}%`)
            .order('created_at', { ascending: false })

        if (error) throw error
        renderMovies(data)
    } catch (error) {
        console.error('Search error:', error)
    }
}

async function handleAddMovie(e) {
    e.preventDefault()

    const formData = {
        title: document.getElementById('title').value,
        director: document.getElementById('director').value,
        release_year: parseInt(document.getElementById('releaseYear').value),
        genre: document.getElementById('genre').value.split(',').map(g => g.trim()),
        rating: parseFloat(document.getElementById('rating').value),
        poster_url: document.getElementById('posterUrl').value
    }

    try {
        const { data, error } = await _supabase
            .from('movies')
            .insert([formData])
            .select()
            .single()

        if (error) throw error

        movies.unshift(data)
        renderMovies(movies)
        closeModal()
        addMovieForm.reset()
    } catch (error) {
        console.error('Add movie error:', error)
        alert('Error adding movie: ' + error.message)
    }
}

async function toggleFavorite(id) {
    const isFav = favorites.includes(id)
    try {
        if (isFav) {
            await _supabase.from('favorites').delete().eq('movie_id', id)
            favorites = favorites.filter(fid => fid !== id)
        } else {
            await _supabase.from('favorites').insert([{ movie_id: id }])
            favorites.push(id)
        }
        updateButtonState(id, 'favorite', !isFav)
    } catch (error) {
        console.error('Favorite toggle error:', error)
    }
}

async function toggleWatchlist(id) {
    const isWatch = watchlist.includes(id)
    try {
        if (isWatch) {
            await _supabase.from('watchlist').delete().eq('movie_id', id)
            watchlist = watchlist.filter(wid => wid !== id)
        } else {
            await _supabase.from('watchlist').insert([{ movie_id: id }])
            watchlist.push(id)
        }
        updateButtonState(id, 'watchlist', !isWatch)
    } catch (error) {
        console.error('Watchlist toggle error:', error)
    }
}

async function deleteMovie(id) {
    if (!confirm('Are you sure you want to delete this movie?')) return

    try {
        const { error } = await _supabase.from('movies').delete().eq('id', id)
        if (error) throw error

        movies = movies.filter(m => m.id !== id)
        renderMovies(movies)
    } catch (error) {
        console.error('Delete error:', error)
        alert('Could not delete movie.')
    }
}

// --- UI Helpers ---

function renderMovies(movieList) {
    movieGrid.innerHTML = ''

    if (movieList.length === 0) {
        emptyState.classList.remove('hidden')
        return
    }

    emptyState.classList.add('hidden')

    movieList.forEach(movie => {
        const isFav = favorites.includes(movie.id)
        const isWatch = watchlist.includes(movie.id)

        const card = document.createElement('div')
        card.className = 'movie-card fade-in'
        card.innerHTML = `
            <div class="poster-wrapper">
                <img src="${movie.poster_url}" alt="${movie.title}" class="movie-poster" onerror="this.src='https://via.placeholder.com/300x450?text=No+Poster'">
                <div class="card-overlay">
                    <div class="movie-info">
                        <h3>${movie.title}</h3>
                        <div class="movie-meta">
                            <span>${movie.release_year}</span>
                            <span class="rating">★ ${movie.rating}</span>
                        </div>
                        <div class="btn-group">
                            <button class="btn-icon favorite-btn ${isFav ? 'active' : ''}" 
                                    onclick="toggleFavorite(${movie.id})" title="Favorite">❤</button>
                            <button class="btn-icon watchlist-btn ${isWatch ? 'active' : ''}" 
                                    onclick="toggleWatchlist(${movie.id})" title="Watchlist">🕒</button>
                            <button class="btn-icon btn-delete" 
                                    onclick="deleteMovie(${movie.id})" title="Delete">🗑</button>
                        </div>
                    </div>
                </div>
            </div>
        `
        movieGrid.appendChild(card)
    })
}

function updateButtonState(movieId, type, isActive) {
    // Find the specific card's button to update UI without re-rendering everything
    // This is simple for a static site
    fetchInitialData() // Re-render for simplicity, or we could target classes
}

function showLoading(show) {
    if (show) {
        loadingState.classList.remove('hidden')
        movieGrid.classList.add('hidden')
    } else {
        loadingState.classList.add('hidden')
        movieGrid.classList.remove('hidden')
    }
}

function closeModal() {
    modalOverlay.classList.add('hidden')
}
