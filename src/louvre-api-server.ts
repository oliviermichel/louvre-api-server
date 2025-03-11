/**
 * Louvre API Server
 * 
 * A server that interacts with the Louvre museum's API to provide access to artwork
 * information, high-resolution images, and user collections.
 */

import express, { Request, Response } from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import * as cheerio from 'cheerio';

// Initialize environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Constants
const BASE_URL = 'https://collections.louvre.fr';
const API_URL = `ark:/53355`;

/**
 * Helper function to make API requests
 */
async function fetchLouvreAPI(path: string, params: Record<string, any> = {}) {
  const url = new URL(path, BASE_URL);
  
  // Add query parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.append(key, String(value));
    }
  });
  
  // Append .json to get JSON response if needed
  if (!url.pathname.endsWith('.json') && !url.pathname.includes('.json?')) {
    url.pathname += '.json';
  }
  
  try {
    const response = await axios.get(url.toString());
    return response.data;
  } catch (error) {
    console.error('Error fetching from Louvre API:', error);
    throw error;
  }
}

/**
 * Format artwork data for consistent response
 */
function formatArtworkData(artwork: any) {
  return {
    id: artwork.id || artwork.ark,
    title: artwork.title || '',
    artist: artwork.creator || '',
    date: artwork.date || '',
    medium: artwork.medium || '',
    dimensions: artwork.dimensions || '',
    description: artwork.description || '',
    image: artwork.image || '',
    url: `${BASE_URL}/{API_URL}/${artwork.id || artwork.ark}`,
  };
}

/**
 * Helper function to parse year from date string
 */
function parseYearFromDate(dateStr: string): number {
  // Attempt to extract a year from various date formats
  const yearMatch = dateStr.match(/\b(\d{4})\b/);
  if (yearMatch) {
    return parseInt(yearMatch[1], 10);
  }
  
  // Handle century descriptions like "17th century"
  const centuryMatch = dateStr.match(/(\d+)(st|nd|rd|th)\s+century/i);
  if (centuryMatch) {
    const century = parseInt(centuryMatch[1], 10);
    return (century - 1) * 100 + 50; // Return mid-century as approximate
  }
  
  return 0; // Default if no year found
}

/**
 * Group artworks by decade for timeline visualization
 */
function groupByDecade(artworks: any[]): Record<string, any[]> {
  const decades: Record<string, any[]> = {};
  
  artworks.forEach(artwork => {
    if (!artwork.year) return;
    
    const decade = Math.floor(artwork.year / 10) * 10;
    const decadeKey = `${decade}s`;
    
    if (!decades[decadeKey]) {
      decades[decadeKey] = [];
    }
    
    decades[decadeKey].push(artwork);
  });
  
  return decades;
}

// Routes

/**
 * Search for artwork on the Louvre website
 */
app.get('/api/search_artwork', async (req: Request, res: Response) => {
  try {
    const { query, page = 1 } = req.query;
    
    if (!query) {
      return res.status(400).json({
        error: 'Search query is required',
      });
    }
    
    // Format the query for URL
    const formattedQuery = encodeURIComponent(query as string);
    const searchUrl = `https://collections.louvre.fr/recherche?page=${page}&q=${formattedQuery}`;
    
    console.log(`Searching Louvre collections: ${searchUrl}`);
    
    // Fetch the search results page
    const response = await axios.get(searchUrl);
    const html = response.data;
    
    // Use cheerio to parse the HTML
    const $ = cheerio.load(html);
    
    // Extract artwork information from the search results
    const artworks: any[] = [];
    
    // Find all artwork cards
    $('#search__grid .card__outer').each((index: number, element: any) => {
      // Extract the URL and ID
      const linkElement = $(element).find('a').first();
      const url = linkElement.attr('href');
      const id = url ? url.split('/').pop() : '';
      
      // Extract the image information
      const imgElement = $(element).find('img');
      const imageUrl = imgElement.attr('data-src') || '';
      const fullTitle = imgElement.attr('title') || '';
      
      // Extract the title and author
      const titleElement = $(element).find('.card__title a');
      const title = titleElement.text().trim();
      
      const authorElement = $(element).find('.card__author');
      const author = authorElement.text().trim();
      
      // Add the artwork to the results
      artworks.push({
        id,
        title,
        fullTitle,
        author,
        imageUrl: imageUrl ? `https://collections.louvre.fr${imageUrl}` : '',
        url: url ? `https://collections.louvre.fr${url}` : '',
      });
    });
    // Get pagination information
    const totalResultsText = $('.search__results__count').text().trim().split(' ')[0] || '0';
    const totalResults = parseInt(totalResultsText.replace(/\D/g, ''));
    const totalPages = Math.ceil(totalResults / 20);
    
    res.json({
      query: query,
      page: parseInt(page as string) || 1,
      totalResults,
      totalPages,
      artworks,
      nextPage: (parseInt(page as string) || 1) < totalPages ? (parseInt(page as string) || 1) + 1 : null,
      prevPage: (parseInt(page as string) || 1) > 1 ? (parseInt(page as string) || 1) - 1 : null,
    });
  } catch (error) {
    console.error('Error searching artwork:', error);
    res.status(500).json({
      error: 'Failed to search for artwork',
      details: (error as Error).message || 'Unknown error',
    });
  }
});
/**
 * Get detailed information about a specific artwork
 */
app.get('/api/get_artwork_details/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const response = await fetchLouvreAPI(`/${API_URL}/${id}`);
    
    res.json({
      ...formatArtworkData(response),
      curatorial_info: response.curatorial_info || '',
      provenance: response.provenance || '',
      exhibition_history: response.exhibition_history || [],
      bibliography: response.bibliography || [],
      related_works: response.related_works || [],
    });
  } catch (error) {
    console.error('Error fetching artwork details:', error);
    res.status(500).json({
      error: 'Failed to get artwork details',
      details: (error as Error).message || 'Unknown error',
    });
  }
});

/**
 * Get images for a specific artwork
 */
app.get('/api/get_artwork_image/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { type = 'all', position } = req.query;
    
    // Get the artwork details first to access image information
    const artworkDetails = await fetchLouvreAPI(`/${API_URL}/${id}`);
    
    if (!artworkDetails.image || artworkDetails.image.length === 0) {
      return res.status(404).json({
        error: 'No images available for this artwork',
      });
    }
    
    // If a specific position is requested, return just that image
    if (position !== undefined) {
      const positionNum = Number(position);
      const specificImage = artworkDetails.image.find((img: any) => img.position === positionNum);
      
      if (!specificImage) {
        return res.status(404).json({
          error: `No image found with position ${position}`,
        });
      }
      
      return res.json({
        id: id,
        artworkTitle: artworkDetails.title,
        image: specificImage,
        position: positionNum
      });
    }
    
    // Group images by type
    const imagesByType: Record<string, any[]> = {};
    
    // Process all images and group them by type
    artworkDetails.image.forEach((img: any) => {
      const imageType = img.type || 'unspecified';
      if (!imagesByType[imageType]) {
        imagesByType[imageType] = [];
      }
      imagesByType[imageType].push(img);
    });
    
    // Get available image types
    const availableTypes = Object.keys(imagesByType);
    
    // If type is 'all', return all images
    if (type === 'all') {
      return res.json({
        id: id,
        artworkTitle: artworkDetails.title,
        images: artworkDetails.image,
        imagesByType: imagesByType,
        availableTypes: availableTypes,
        totalImages: artworkDetails.image.length
      });
    }
    
    // If requested type doesn't exist, use the first available type
    const selectedType = availableTypes.includes(type as string) 
      ? type as string 
      : availableTypes[0] || 'unspecified';
    
    // Get images of the selected type
    const selectedImages = imagesByType[selectedType] || [];
    
    // Sort images by position
    selectedImages.sort((a, b) => a.position - b.position);
    
    res.json({
      id: id,
      artworkTitle: artworkDetails.title,
      images: selectedImages,
      selectedType: selectedType,
      availableTypes: availableTypes,
      totalImages: artworkDetails.image.length
    });
  } catch (error) {
    console.error('Error fetching artwork images:', error);
    res.status(500).json({
      error: 'Failed to get artwork image',
      details: (error as Error).message || 'Unknown error',
    });
  }
});

/**
 * Generate a chronological timeline of an artist's works
 */
app.get('/api/get_artist_timeline', async (req: Request, res: Response) => {
  try {
    const { artist, sortBy = 'date' } = req.query;
    
    if (!artist) {
      return res.status(400).json({
        error: 'Artist parameter is required',
      });
    }
    
    // Format the search URL using the advanced search with authorStr parameter
    const searchUrl = `${BASE_URL}/recherche?sort=date&advanced=1&authorStr[0]=${encodeURIComponent(artist as string)}`;
    
    console.log(`Searching artist works: ${searchUrl}`);
    
    // Fetch the search results page
    const response = await axios.get(searchUrl);
    const html = response.data;
    
    // Use cheerio to parse the HTML
    const $ = cheerio.load(html);
    
    // Extract artwork information from the search results
    const artworks: any[] = [];
    
    // Find all artwork cards
    $('#search__grid .card__outer').each((index: number, element: any) => {
      // Extract the URL and ID
      const linkElement = $(element).find('a').first();
      const url = linkElement.attr('href');
      const id = url ? url.split('/').pop() : '';
      
      // Extract the image information
      const imgElement = $(element).find('img');
      const imageUrl = imgElement.attr('data-src') || '';
      const fullTitle = imgElement.attr('title') || '';
      
      // Extract the title and author
      const titleElement = $(element).find('.card__title a');
      const title = titleElement.text().trim();
      
      const authorElement = $(element).find('.card__author');
      const author = authorElement.text().trim();
      
      // Extract the date if available
      const dateElement = $(element).find('.card__date');
      const date = dateElement.text().trim();
      const year = parseYearFromDate(date);
      
      // Add the artwork to the results
      artworks.push({
        id,
        title,
        fullTitle,
        author,
        date,
        year,
        imageUrl: imageUrl ? `https://collections.louvre.fr${imageUrl}` : '',
        url: url ? `https://collections.louvre.fr${url}` : '',
      });
    });
    
    // Get total results count from the span with id "count_text"
    const totalResultsText = $('#count_text').text().trim().replace(/résultat/gi, '').trim() || '0';
    const totalResults = parseInt(totalResultsText.replace(/\D/g, ''));
    
    // Sort artworks based on the sortBy parameter
    const sortedArtworks = artworks.sort((a: any, b: any) => {
      if (sortBy === 'date') {
        return a.year - b.year;
      } else if (sortBy === 'popularity') {
        return (b.popularity || 0) - (a.popularity || 0);
      }
      return 0;
    });
    
    // Group by periods/decades for easier visualization
    const timelineByDecade = groupByDecade(sortedArtworks);
    
    res.json({
      artist: artist,
      total_works: totalResults,
      timeline: {
        chronological: sortedArtworks,
        by_decade: timelineByDecade,
      },
      earliest_work: sortedArtworks[0],
      latest_work: sortedArtworks[sortedArtworks.length - 1],
    });
  } catch (error) {
    console.error('Error generating artist timeline:', error);
    res.status(500).json({
      error: 'Failed to generate artist timeline',
      details: (error as Error).message || 'Unknown error',
    });
  }
});

/**
 * Health check endpoint for monitoring
 */
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Louvre API server running on port ${PORT}`);
});

export default app;
