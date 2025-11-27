import React, { useEffect, useState } from 'react';
import { fetchTrendingMovies, discoverMoviesByGenre, searchMovies } from '../services/tmdbService';
import { getAIRecommendations } from '../services/geminiService';
import { Movie } from '../types';
import MovieCard from '../components/MovieCard';
import MovieDetailsModal from '../components/MovieDetailsModal';
import { Sparkles, Loader2, Filter, Search, X, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';

// Basic genres list for Discovery
const GENRES = [
    { id: 0, name: 'Trending' },
    { id: 28, name: 'Action' },
    { id: 35, name: 'Comedy' },
    { id: 18, name: 'Drama' },
    { id: 878, name: 'Sci-Fi' },
    { id: 27, name: 'Horror' },
    { id: 10749, name: 'Romance' },
];

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  
  // Data State
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  // User Data State
  const [watchlist, setWatchlist] = useState<number[]>([]);
  
  // Filter State
  const [selectedGenre, setSelectedGenre] = useState(0);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // AI State
  const [aiRecommendation, setAiRecommendation] = useState<string>("");
  const [loadingAi, setLoadingAi] = useState(false);

  // --- Data Fetching Logic ---
  useEffect(() => {
    const loadMovies = async () => {
      // If it's page 1, show main loader. If page > 1, show "loading more" spinner at bottom
      if (page === 1) setLoading(true);
      else setLoadingMore(true);

      let data: Movie[] = [];
      
      try {
          if (isSearching) {
              data = await searchMovies(searchQuery, page);
          } else if (selectedGenre === 0) {
              data = await fetchTrendingMovies(page);
          } else {
              data = await discoverMoviesByGenre(selectedGenre, page);
          }

          if (page === 1) {
              setMovies(data);
          } else {
              setMovies(prev => [...prev, ...data]);
          }
          
          // If we got fewer than 20 results, we reached the end
          setHasMore(data.length === 20);

      } catch (e) {
          console.error("Fetch error", e);
      } finally {
          setLoading(false);
          setLoadingMore(false);
      }
    };
    
    // Debounce search slightly to avoid rapid firing on page change
    const timeoutId = setTimeout(() => {
        loadMovies();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [selectedGenre, isSearching, page, searchQuery]); 
  // Note: searchQuery is in dependency array but we control it via isSearching flag for API calls mostly,
  // except when typing in the search box we might want to debounce. 
  // Current implementation: handleSearch sets isSearching=true which triggers effect.

  // Fetch watchlist
  useEffect(() => {
      const loadUserLibrary = async () => {
          if (user) {
              const { data } = await supabase
                  .from('user_library')
                  .select('movie_id')
                  .eq('user_id', user.id)
                  .eq('status', 'watchlist');
              
              if (data) {
                  setWatchlist(data.map(item => item.movie_id));
              }
          }
      };
      loadUserLibrary();
  }, [user]);

  // --- Handlers ---

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    // Reset Everything for Search
    setPage(1);
    setSelectedGenre(0);
    setIsSearching(true);
    setMovies([]); // Clear current to show loading
  };

  const handleGenreSelect = (id: number) => {
      // Clear search, reset page, set genre
      setSearchQuery('');
      setIsSearching(false);
      setPage(1);
      setSelectedGenre(id);
      setMovies([]);
  };

  const clearSearch = () => {
      setSearchQuery('');
      setIsSearching(false);
      setSelectedGenre(0);
      setPage(1);
  };

  const loadMore = () => {
      setPage(prev => prev + 1);
  };

  const handleAddToWatchlist = async (id: number) => {
    if (!user) {
        alert("Please wait for the secure connection to establish...");
        return;
    }

    setWatchlist(prev => [...prev, id]);
    
    // Persist to Supabase
    await supabase.from('user_library').upsert({
        user_id: user.id,
        movie_id: id,
        status: 'watchlist'
    }, { onConflict: 'user_id,movie_id' });
  };

  const handleGetAiRecs = async () => {
    setLoadingAi(true);
    const rec = await getAIRecommendations(
      ["Dune", "Interstellar", "Inception"],
      "Sci-Fi Thriller"
    );
    setAiRecommendation(rec);
    setLoadingAi(false);
  };

  return (
    <div className="min-h-screen pb-20">
      {/* Hero Section */}
      <div className="bg-indigo-900/30 border-b border-indigo-900/50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Welcome to CineSync</h1>
            <p className="text-indigo-200 text-lg">See what's trending at VITAP right now.</p>
          </div>
          
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="w-full md:w-auto relative group">
              <input 
                type="text" 
                placeholder="Search movies..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full md:w-80 bg-slate-800/80 border border-slate-600 rounded-full px-5 py-3 pl-12 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-100 placeholder-slate-400 transition-all shadow-lg"
              />
              <Search className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-indigo-400 transition-colors" size={20} />
          </form>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        
        {/* AI Section (Only show on Dashboard home) */}
        {!isSearching && selectedGenre === 0 && page === 1 && (
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 mb-12 shadow-xl">
                <div className="flex items-start gap-4">
                    <div className="bg-indigo-500/20 p-3 rounded-xl">
                        <Sparkles className="text-indigo-400" size={24} />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-xl font-semibold text-white">Gemini AI Assistant</h2>
                        <p className="text-slate-400 text-sm mt-1">
                            Not sure what to watch during finals week? Let AI decide.
                        </p>
                        
                        {!aiRecommendation && !loadingAi && (
                            <button 
                                onClick={handleGetAiRecs}
                                className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white text-sm font-medium transition-all"
                            >
                                Get Smart Recommendations
                            </button>
                        )}

                        {loadingAi && (
                            <div className="mt-4 flex items-center gap-2 text-indigo-400">
                                <Loader2 className="animate-spin" size={18} />
                                <span className="text-sm">Gemini is thinking...</span>
                            </div>
                        )}

                        {aiRecommendation && (
                            <div className="mt-4 bg-slate-800/50 p-4 rounded-lg border border-slate-700 text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">
                                {aiRecommendation}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* Discovery Filter Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <h2 className="text-2xl font-bold text-white pl-2 border-l-4 border-indigo-500 flex items-center gap-2">
                {isSearching ? `Search Results: "${searchQuery}"` : (selectedGenre === 0 ? "Trending at VITAP" : `${GENRES.find(g => g.id === selectedGenre)?.name} Movies`)}
                {isSearching && (
                    <button onClick={clearSearch} className="ml-2 p-1 bg-slate-700 rounded-full hover:bg-slate-600 text-xs font-normal flex items-center gap-1 px-3">
                        <X size={12} /> Clear
                    </button>
                )}
            </h2>
            
            {/* Genre Buttons */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                <Filter size={16} className="text-slate-500 mr-1" />
                {GENRES.map(genre => (
                    <button
                        key={genre.id}
                        onClick={() => handleGenreSelect(genre.id)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                            selectedGenre === genre.id && !isSearching
                            ? 'bg-indigo-600 text-white' 
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                        }`}
                    >
                        {genre.name}
                    </button>
                ))}
            </div>
        </div>
        
        {loading ? (
           <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
             {[...Array(10)].map((_, i) => (
               <div key={i} className="bg-slate-800 h-96 rounded-xl animate-pulse"></div>
             ))}
           </div>
        ) : (
          <>
            {movies.length === 0 && (
                <div className="text-center py-20 text-slate-500">
                    <Search size={48} className="mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No movies found. Try searching for "Inception" or "Salaar".</p>
                </div>
            )}
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {movies.map((movie, index) => (
                    // Using index as part of key because TMDB sometimes duplicates items across pages
                    <MovieCard 
                        key={`${movie.id}-${index}`} 
                        movie={movie} 
                        onAdd={handleAddToWatchlist}
                        isAdded={watchlist.includes(movie.id)}
                        onClick={() => setSelectedMovie(movie)}
                    />
                ))}
            </div>

            {/* Load More Button */}
            {hasMore && movies.length > 0 && (
                <div className="mt-12 flex justify-center">
                    <button 
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="flex items-center gap-2 px-8 py-3 bg-slate-800 hover:bg-slate-700 rounded-full font-semibold text-white transition-all shadow-lg"
                    >
                        {loadingMore ? (
                            <>
                                <Loader2 className="animate-spin" size={20} /> Loading...
                            </>
                        ) : (
                            <>
                                <ChevronDown size={20} /> Load More Movies
                            </>
                        )}
                    </button>
                </div>
            )}
          </>
        )}
      </div>

      {/* Movie Details Modal */}
      {selectedMovie && (
          <MovieDetailsModal 
            movie={selectedMovie} 
            onClose={() => setSelectedMovie(null)} 
            onAdd={handleAddToWatchlist}
            isAdded={watchlist.includes(selectedMovie.id)}
          />
      )}
    </div>
  );
};

export default Dashboard;