require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

app.use(cors());
app.use(express.json());

// ─── MOVIES ────────────────────────────────────────────────────────────────

// GET /movies - Get all movies, optional search by title
app.get('/movies', async (req, res) => {
  let query = supabase.from('movies').select('*');

  if (req.query.search) {
    query = query.ilike('title', `%${req.query.search}%`);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Map snake_case back to camelCase for the frontend
  const movies = data.map(m => ({
    id: m.id,
    title: m.title,
    director: m.director,
    releaseYear: m.release_year,
    genre: m.genre,
    rating: m.rating,
    posterUrl: m.poster_url,
  }));

  res.json(movies);
});

// POST /movies - Add a new movie
app.post('/movies', async (req, res) => {
  const { title, director, releaseYear, genre, rating, posterUrl } = req.body;

  if (!title || !director || !releaseYear || !genre || !rating || !posterUrl) {
    return res.status(400).json({ error: 'Missing required movie fields' });
  }

  const { data, error } = await supabase
    .from('movies')
    .insert([{ title, director, release_year: releaseYear, genre, rating, poster_url: posterUrl }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  res.status(201).json({
    id: data.id,
    title: data.title,
    director: data.director,
    releaseYear: data.release_year,
    genre: data.genre,
    rating: data.rating,
    posterUrl: data.poster_url,
  });
});

// PUT /movies/:id - Edit an existing movie
app.put('/movies/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { title, director, releaseYear, genre, rating, posterUrl } = req.body;

  const updates = {};
  if (title !== undefined) updates.title = title;
  if (director !== undefined) updates.director = director;
  if (releaseYear !== undefined) updates.release_year = releaseYear;
  if (genre !== undefined) updates.genre = genre;
  if (rating !== undefined) updates.rating = rating;
  if (posterUrl !== undefined) updates.poster_url = posterUrl;

  const { data, error } = await supabase
    .from('movies')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(error.code === 'PGRST116' ? 404 : 500).json({ error: error.message });

  res.json({
    id: data.id,
    title: data.title,
    director: data.director,
    releaseYear: data.release_year,
    genre: data.genre,
    rating: data.rating,
    posterUrl: data.poster_url,
  });
});

// DELETE /movies/:id - Delete a movie
app.delete('/movies/:id', async (req, res) => {
  const id = parseInt(req.params.id);

  const { error } = await supabase.from('movies').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });

  res.json({ message: 'Movie deleted' });
});

// ─── FAVORITES ─────────────────────────────────────────────────────────────

// GET /favorites - Get all favorite movie IDs
app.get('/favorites', async (req, res) => {
  const { data, error } = await supabase.from('favorites').select('movie_id');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(f => f.movie_id));
});

// POST /favorites/:id - Toggle favorite
app.post('/favorites/:id', async (req, res) => {
  const id = parseInt(req.params.id);

  // Check movie exists
  const { data: movie, error: movieError } = await supabase
    .from('movies').select('id').eq('id', id).single();
  if (movieError || !movie) return res.status(404).json({ error: 'Movie not found' });

  // Check if already in favorites
  const { data: existing } = await supabase
    .from('favorites').select('movie_id').eq('movie_id', id).single();

  if (existing) {
    await supabase.from('favorites').delete().eq('movie_id', id);
  } else {
    await supabase.from('favorites').insert([{ movie_id: id }]);
  }

  const { data: updated } = await supabase.from('favorites').select('movie_id');
  res.json(updated.map(f => f.movie_id));
});

// ─── WATCHLIST ─────────────────────────────────────────────────────────────

// GET /watchlist - Get all watchlist movie IDs
app.get('/watchlist', async (req, res) => {
  const { data, error } = await supabase.from('watchlist').select('movie_id');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(w => w.movie_id));
});

// POST /watchlist/:id - Toggle watchlist
app.post('/watchlist/:id', async (req, res) => {
  const id = parseInt(req.params.id);

  // Check movie exists
  const { data: movie, error: movieError } = await supabase
    .from('movies').select('id').eq('id', id).single();
  if (movieError || !movie) return res.status(404).json({ error: 'Movie not found' });

  // Check if already in watchlist
  const { data: existing } = await supabase
    .from('watchlist').select('movie_id').eq('movie_id', id).single();

  if (existing) {
    await supabase.from('watchlist').delete().eq('movie_id', id);
  } else {
    await supabase.from('watchlist').insert([{ movie_id: id }]);
  }

  const { data: updated } = await supabase.from('watchlist').select('movie_id');
  res.json(updated.map(w => w.movie_id));
});

// ─── START SERVER ──────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
