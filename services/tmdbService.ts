import { Movie } from '../types';

const API_KEY = '1f54bd990f1cdfb230adb312546d765d';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const BACKDROP_BASE_URL = 'https://image.tmdb.org/t/p/w1280';

export const fetchTrendingMovies = async (page: number = 1): Promise<Movie[]> => {
  try {
    const response = await fetch(`${BASE_URL}/trending/movie/week?api_key=${API_KEY}&page=${page}`);
    const data = await response.json();
    return data.results.map((m: any) => transformMovie(m));
  } catch (error) {
    console.error("Error fetching trending movies:", error);
    return [];
  }
};

export const discoverMoviesByGenre = async (genreId: number, page: number = 1): Promise<Movie[]> => {
  try {
    const response = await fetch(`${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=${genreId}&sort_by=popularity.desc&page=${page}`);
    const data = await response.json();
    return data.results.map((m: any) => transformMovie(m));
  } catch (error) {
    console.error("Error discovering movies:", error);
    return [];
  }
};

export const searchMovies = async (query: string, page: number = 1): Promise<Movie[]> => {
  if (!query) return [];
  try {
    const response = await fetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}&page=${page}`);
    const data = await response.json();
    return data.results.map((m: any) => transformMovie(m));
  } catch (error) {
    console.error("Error searching movies:", error);
    return [];
  }
};

export const getMovieById = async (id: number): Promise<Movie | null> => {
  try {
    const response = await fetch(`${BASE_URL}/movie/${id}?api_key=${API_KEY}`);
    if (!response.ok) return null;
    const m = await response.json();
    return transformMovie(m);
  } catch (error) {
    console.error(`Error fetching movie ${id}:`, error);
    return null;
  }
};

const transformMovie = (m: any): Movie => {
    return {
      id: m.id,
      title: m.title,
      poster_path: m.poster_path ? `${IMAGE_BASE_URL}${m.poster_path}` : 'https://placehold.co/300x450?text=No+Image',
      // Add backdrop if available, fallback to poster
      backdrop_path: m.backdrop_path ? `${BACKDROP_BASE_URL}${m.backdrop_path}` : (m.poster_path ? `${IMAGE_BASE_URL}${m.poster_path}` : undefined),
      overview: m.overview,
      vote_average: m.vote_average,
      release_date: m.release_date || 'Unknown'
    };
};