# Louvre API Server

A Node.js API server that provides access to artwork data from the Louvre Museum collection.

## Features

- Search for artwork by query term
- Get detailed information about specific artworks
- Get artwork images organized by type
- Generate artist timelines
- Search by artist name

## API Endpoints

- `/api/search_artwork?query=mona+lisa` - Search for artwork
- `/api/get_artwork_details/:id` - Get detailed information about an artwork
- `/api/get_artwork_image/:id` - Get images for an artwork
- `/api/get_artist_timeline?artist=picasso` - Get a timeline of an artist's works

## Deployment

### Prerequisites

- Node.js 14+ and npm

### Local Development

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the development server:
   ```
   npm run dev
   ```

### Deployment to GitHub

This project is set up to be deployed using GitHub Actions. Here's how to set it up:

1. Fork or push this repository to your GitHub account
2. Enable GitHub Actions in your repository settings
3. Set up GitHub Pages:
   - Go to your repository settings
   - Navigate to "Pages"
   - Select "GitHub Actions" as the source

#### For Deploying the API to Render:

1. Create an account on [Render](https://render.com)
2. Create a new Web Service and connect it to your GitHub repository
3. Add the following environment variables in your GitHub repository:
   - `RENDER_SERVICE_ID`: Your Render service ID
   - `RENDER_API_KEY`: Your Render API key

To add these secrets:
- Go to your repository settings
- Click on "Secrets and variables" → "Actions"
- Click "New repository secret" and add each secret

The GitHub Actions workflow will automatically deploy your API when you push to the main branch.

## Environment Variables

- `PORT` - The port to run the server on (default: 3000)

## License

MIT 