# Font Files Setup

This project uses two GT fonts for optimal typography:
- **GT Spectra Book** for headings (h1-h6)
- **GT Pressura Extended** for body text

## Required Files:

### GT Pressura Extended (Body Text):
- `GT-Pressura-Extended.woff2` - Web Open Font Format 2.0 (recommended)
- `GT-Pressura-Extended.woff` - Web Open Font Format (fallback)

### GT Spectra Book (Headings):
- `GT-Spectra-Book.woff2` - Web Open Font Format 2.0 (recommended)
- `GT-Spectra-Book.woff` - Web Open Font Format (fallback)

## How to Add:
1. Obtain both font families from your font provider
2. Place all font files in this directory
3. Ensure the filenames match exactly:
   - `GT-Pressura-Extended.woff2` and `GT-Pressura-Extended.woff`
   - `GT-Spectra-Book.woff2` and `GT-Spectra-Book.woff`

## Font Information:
- **GT Pressura Extended**: Body text, sans-serif, weight 400
- **GT Spectra Book**: Headings, serif, weight 400
- Both fonts use `font-display: swap` for better performance

## Usage:
The fonts are configured in your CSS and Tailwind config:

### CSS Classes:
- Body text: `font-family: 'GT Pressura Extended', sans-serif;`
- Headings: `font-family: 'GT Spectra Book', serif;`

### Tailwind Classes:
- Body text: `font-pressura` class
- Headings: `font-spectra` class

### Automatic Application:
- All `<h1>` through `<h6>` elements automatically use GT Spectra Book
- Body text automatically uses GT Pressura Extended

## Note:
Both GT Pressura and GT Spectra are proprietary fonts. Make sure you have the proper licenses to use them in your project.
