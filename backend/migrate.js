require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

async function migrate() {
    // Read existing db.json
    const dbPath = path.join(__dirname, 'db.json');
    const raw = fs.readFileSync(dbPath, 'utf8');
    const db = JSON.parse(raw);

    const movies = db.movies || [];
    const favorites = db.favorites || [];
    const watchlist = db.watchlist || [];

    if (movies.length === 0) {
        console.log('No movies found in db.json. Nothing to migrate.');
        return;
    }

    // Map camelCase JSON fields to snake_case Supabase columns
    const mappedMovies = movies.map(({ title, director, releaseYear, genre, rating, posterUrl }) => ({
        title,
        director,
        release_year: releaseYear,
        genre,
        rating,
        poster_url: posterUrl,
    }));

    // Insert movies
    console.log(`Inserting ${mappedMovies.length} movie(s)...`);
    const { error: moviesError } = await supabase.from('movies').upsert(mappedMovies);
    if (moviesError) {
        console.error('Error inserting movies:', moviesError.message);
        return;
    }
    console.log('Movies inserted.');

    // Insert favorites
    if (favorites.length > 0) {
        console.log(`Inserting ${favorites.length} favorite(s)...`);
        const { error: favsError } = await supabase
            .from('favorites')
            .upsert(favorites.map(id => ({ movie_id: id })));
        if (favsError) {
            console.error('Error inserting favorites:', favsError.message);
            return;
        }
        console.log('Favorites inserted.');
    }

    // Insert watchlist
    if (watchlist.length > 0) {
        console.log(`Inserting ${watchlist.length} watchlist item(s)...`);
        const { error: watchError } = await supabase
            .from('watchlist')
            .upsert(watchlist.map(id => ({ movie_id: id })));
        if (watchError) {
            console.error('Error inserting watchlist:', watchError.message);
            return;
        }
        console.log('Watchlist inserted.');
    }

    console.log('\n✅ Migration complete!');
}

migrate().catch(console.error);
