import { Movie } from '../types';

const API_KEY = '1f54bd990f1cdfb230adb312546d765d';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

export const fetchTrendingMovies = async (): Promise<Movie[]> => {
  try {
    const response = await fetch(`${BASE_URL}/trending/movie/week?api_key=${API_KEY}`);
    const data = await response.json();
    
    return data.results.map((m: any) => ({
      id: m.id,
      title: m.title,
      poster_path: m.poster_path ? `${IMAGE_BASE_URL}${m.poster_path}` : 'https://placehold.co/300x450?text=No+Image',
      overview: m.overview,
      vote_average: m.vote_average,
      release_date: m.release_date
    })).slice(0, 10);
  } catch (error) {
    console.error("Error fetching trending movies:", error);
    return [];
  }
};

export const searchMovies = async (query: string): Promise<Movie[]> => {
  if (!query) return [];
  try {
    const response = await fetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}`);
    const data = await response.json();
    
    return data.results.map((m: any) => ({
        id: m.id,
        title: m.title,
        poster_path: m.poster_path ? `${IMAGE_BASE_URL}${m.poster_path}` : 'https://placehold.co/300x450?text=No+Image',
        overview: m.overview,
        vote_average: m.vote_average,
        release_date: m.release_date || 'Unknown'
    }));
  } catch (error) {
    console.error("Error searching movies:", error);
    return [];
  }
};