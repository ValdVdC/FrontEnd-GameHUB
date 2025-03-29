export interface Game {
    id: number;
    name: string;
    genres: string[];
    cover_url: string;
    total_rating?: number;
    popularity_value?:number;
    platforms?: string[];
    themes?: string[];
    game_modes?:string[];
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
  
  export interface PlatformCategory {
    id: number;
    value: {
      platform: string;
      games: Game[];
    };
    status: string;
    startIndex?: number;
  }