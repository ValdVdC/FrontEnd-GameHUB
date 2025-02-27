export interface Game {
    id: number;
    name: string;
    genres: string[];
    cover_url: string;
    total_rating?: number;
  }
  
  export interface ApiResponse {
    games: Game[];
    pagination: {
      currentPage: number;
      pageSize: number;
      hasMore: boolean;
    };
  }
  
  export interface GenreCategory {
    id: number;
    value: {
      genre: string;
      games: Game[];
    };
  }