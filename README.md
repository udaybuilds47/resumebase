# ResumeBase

A modern web application for automating web interactions and managing browser sessions using Browserbase and Google Gemini AI.

## 🎯 What is ResumeBase?

ResumeBase is a web automation platform that allows you to:

- **Start Browser Sessions**: Launch automated browser sessions using Browserbase
- **Web Automation**: Navigate to any URL and interact with web applications
- **AI-Powered Interactions**: Use Google Gemini AI to enhance web automation
- **Session Management**: Monitor and control browser sessions in real-time
- **Debugging Tools**: Access browser debugging interfaces for development

The application provides a simple interface where you can input any web application URL, and it will automatically start a browser session, navigate to that URL, and provide you with debugging and viewing capabilities.

## 🏗️ Project Structure

```
resumebase/
├── web/                 # Next.js application with API routes
│   ├── src/
│   │   ├── app/        # App router pages and API routes
│   │   ├── components/ # Reusable UI components
│   │   └── lib/        # Utility functions and configurations
│   ├── public/         # Static assets
│   └── package.json    # Dependencies
└── README.md           # This file
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm, yarn, or pnpm
- Git
- Browserbase API key and Project ID
- Google Gemini API key

### Getting Started

1. Navigate to the web directory:
   ```bash
   cd web
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. Set up environment variables:
   Create a `.env.local` file in the `web` directory with:
   ```env
   BROWSERBASE_API_KEY=your_browserbase_api_key
   BROWSERBASE_PROJECT_ID=your_browserbase_project_id
   GOOGLE_API_KEY=your_google_gemini_api_key
   GOOGLE_MODEL=gemini-1.5-flash
   ```

4. Run the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🛠️ Tech Stack

- **Next.js 15** - React framework with App Router and API routes
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS 4** - Utility-first CSS framework
- **shadcn/ui** - Modern UI components
- **Browserbase SDK** - Web automation and browser session management
- **Google Gemini AI** - AI-powered web interaction
- **ESLint** - Code linting

## 📁 Key Directories

### `/web`
- **`src/app/`** - Next.js App Router pages and API routes
- **`src/app/api/`** - API endpoints for session management
- **`src/components/`** - Reusable React components (shadcn/ui)
- **`src/lib/`** - Utility functions and configurations
- **`public/`** - Static assets (images, icons, etc.)

## 🔧 Development

### Available Scripts

```bash
npm run dev          # Start development server with Turbopack
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Code Style

- Use TypeScript for type safety
- Follow ESLint configuration
- Use Prettier for code formatting
- Follow Next.js and React best practices

## 🌐 Environment Variables

Create a `.env.local` file in the `web` directory:

```env
BROWSERBASE_API_KEY=your_browserbase_api_key
BROWSERBASE_PROJECT_ID=your_browserbase_project_id
GOOGLE_API_KEY=your_google_gemini_api_key
GOOGLE_MODEL=gemini-1.5-flash
```

### Required API Keys

- **Browserbase**: Get your API key and Project ID from [Browserbase](https://browserbase.com/)
- **Google Gemini**: Get your API key from [Google AI Studio](https://aistudio.google.com/)

## 📦 Dependencies

- **Next.js 15** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Styling framework
- **shadcn/ui** - Modern UI components
- **Browserbase SDK** - Web automation and browser management
- **Google Gemini AI** - AI-powered interactions
- **Zod** - Schema validation
- **Sonner** - Toast notifications

## 🚀 Deployment

- Deploy to Vercel (recommended for Next.js)
- Or deploy to any platform that supports Node.js applications
- Ensure all environment variables are configured in your deployment platform

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/yourusername/resumebase/issues) page
2. Create a new issue with detailed information
3. Contact the development team

## 🔮 Roadmap

- [ ] Enhanced session management
- [ ] Multiple browser session support
- [ ] Advanced web automation workflows
- [ ] Session recording and playback
- [ ] AI-powered web interaction analysis
- [ ] Mobile-responsive design improvements
- [ ] Real-time collaboration features
- [ ] Advanced error handling and retry mechanisms

---

**Happy coding! 🎉**
