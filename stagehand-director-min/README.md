# ResumeBase - Web Automation & Session Recording Platform

A sophisticated web automation platform that combines AI-powered browser automation with comprehensive session recording and replay capabilities.

## 🏗️ Architecture

The project follows a **client-server architecture** with two main components:

### Frontend (`web/`)
- **Framework**: Next.js 15 with React 19 and TypeScript
- **Styling**: Tailwind CSS with custom UI components
- **Key Features**: 
  - Task input interface for describing automation tasks
  - Live view tab showing real-time browser automation
  - Session replay tab for reviewing recorded sessions
  - Responsive design with smooth animations and transitions

### Backend (`server/`)
- **Framework**: Fastify with TypeScript
- **Core Technology**: BrowserBase SDK and Stagehand for browser automation
- **API Endpoints**:
  - `POST /start` - Initiates browser automation sessions
  - `GET /recording/:sessionId` - Retrieves session recordings for replay

## 🚀 Core Functionality

### 1. Browser Automation Engine
- **Task Input**: Users describe tasks in natural language (e.g., "go to duckduck")
- **AI-Powered Execution**: Uses OpenAI GPT-4 or Google AI models to interpret and execute browser actions
- **Step-by-Step Automation**: Supports up to 25 automation steps with automatic screenshots
- **Safety Controls**: Domain allowlisting, restrictions on bypassing security measures

### 2. Live Session Monitoring
- **Real-time View**: Live iframe display of active browser automation
- **WebSocket Monitoring**: Multiple fallback WebSocket URL patterns for connection monitoring
- **Connection Detection**: Automatic detection of when live sessions end
- **Smart Tab Management**: Automatic switching from live view to replay when sessions complete

### 3. Session Recording & Replay
- **Session Capture**: Records all browser interactions during automation
- **Replay Player**: Full-featured session replay with `rrweb-player`
- **Responsive Scaling**: Adaptive sizing and scaling for different screen dimensions
- **Playback Controls**: Play, pause, and navigation through recorded sessions

### 4. User Interface
- **Dual Tab System**: Live view and session replay tabs
- **Responsive Design**: Mobile-friendly layout with smooth animations
- **Real-time Feedback**: Loading states, error handling, and status updates
- **Modern UI**: Clean, professional interface using Tailwind CSS

## 📦 Package Dependencies

### Frontend Packages (`web/`)

#### Core Framework
```json
"next": "15.4.6"           // React framework with App Router
"react": "19.1.0"          // Latest React version
"react-dom": "19.1.0"      // React DOM rendering
"typescript": "^5"          // Type safety
```

#### UI Components & Styling
```json
"@radix-ui/react-slot": "^1.2.3"    // Accessible UI primitives
"class-variance-authority": "^0.7.1" // Component variant management
"clsx": "^2.1.1"                    // Conditional CSS classes
"lucide-react": "^0.539.0"          // Icon library
"tailwind-merge": "^3.3.1"          // Tailwind class merging
```

#### Session Recording & Playback
```json
"rrweb": "2.0.0-alpha.4"           // Session recording library
"rrweb-player": "1.0.0-alpha.4"    // Session replay player
```

#### Development & Build Tools
```json
"autoprefixer": "^10.4.21"          // CSS vendor prefixing
"postcss": "^8.5.6"                 // CSS processing
"tailwindcss": "^3.4.0"             // Utility-first CSS framework
"tailwindcss-animate": "^1.0.7"     // Tailwind animation utilities
"eslint": "^9"                      // Code linting
```

### Backend Packages (`server/`)

#### Web Framework
```json
"fastify": "^5.4.0"                 // High-performance web framework
"@fastify/cors": "^11.1.0"          // CORS middleware
```

#### Browser Automation
```json
"@browserbasehq/sdk": "^2.6.0"     // BrowserBase API client
"@browserbasehq/stagehand": "^2.4.2" // AI-powered browser automation
```

#### AI Integration
```json
"openai": "^5.12.2"                 // OpenAI API client
```

#### Development Tools
```json
"tsx": "^4.20.3"                    // TypeScript execution
"dotenv": "^17.2.1"                 // Environment variable management
"typescript": "^5.9.2"              // Type safety
```

## 🔄 Key Functionality Breakdown

### 1. Task Execution Flow
```
User Input → AI Interpretation → Browser Automation → Session Recording → Live View → Session Replay
```

### 2. Real-time Monitoring Features
- **WebSocket Connections**: Multiple URL patterns for reliability
- **Iframe Monitoring**: Fallback connection status detection
- **Timer-based Fallbacks**: Safety mechanisms for edge cases
- **Automatic State Management**: Seamless transitions between live and replay modes

### 3. Session Replay Capabilities
- **Event-based Playback**: Replays all recorded browser interactions
- **Responsive Scaling**: Automatically fits content to container dimensions
- **Error Recovery**: Retry mechanisms for failed recording fetches
- **Performance Optimization**: Efficient rendering with ResizeObserver

### 4. Security & Safety Features
- **Domain Restrictions**: Configurable allowlist for navigation
- **Security Bypass Prevention**: Blocks login bypass, CAPTCHA circumvention
- **Input Validation**: Comprehensive error handling and user feedback
- **API Key Management**: Secure handling of external service credentials

### 5. User Experience Features
- **Smooth Animations**: CSS transitions and animations for state changes
- **Loading States**: Comprehensive feedback during operations
- **Error Handling**: User-friendly error messages and recovery options
- **Responsive Design**: Mobile-first approach with adaptive layouts

## 🔌 Integration Points

### External Services
- **BrowserBase**: Browser automation infrastructure
- **OpenAI/Google AI**: Natural language processing and task execution
- **WebSocket Services**: Real-time communication for live sessions

### Data Flow
- **Session Management**: Unique session IDs and run tracking
- **Recording Storage**: BrowserBase-hosted session recordings
- **Real-time Updates**: WebSocket-based live session monitoring
- **State Persistence**: Client-side state management with React hooks

## 🎯 Use Cases

This platform is ideal for:
- **QA Testing**: Automating repetitive browser testing scenarios
- **Training & Documentation**: Recording and replaying user workflows
- **Debugging**: Analyzing browser automation sessions step-by-step
- **Demo Creation**: Building interactive demonstrations of web processes

## 🏛️ Project Structure

```
stagehand-director-min/
├── server/                 # Backend API server
│   ├── src/
│   │   └── index.ts       # Fastify server with automation endpoints
│   ├── package.json       # Backend dependencies
│   └── tsconfig.json      # TypeScript configuration
├── web/                    # Frontend Next.js application
│   ├── src/
│   │   ├── app/           # Next.js App Router pages
│   │   ├── components/    # React components
│   │   │   ├── SessionReplay.tsx  # Session replay player
│   │   │   └── ui/        # Reusable UI components
│   │   ├── lib/           # Utility functions
│   │   └── types/         # TypeScript type definitions
│   ├── package.json       # Frontend dependencies
│   └── tailwind.config.js # Tailwind CSS configuration
└── README.md              # This file
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and pnpm
- BrowserBase API key and project ID
- OpenAI or Google AI API key

### Installation
```bash
# Install backend dependencies
cd server
pnpm install

# Install frontend dependencies
cd ../web
pnpm install
```

### Environment Variables
Create `.env` files in both `server/` and `web/` directories:

**Server Environment Variables:**
```env
BROWSERBASE_API_KEY=your_browserbase_api_key
BROWSERBASE_PROJECT_ID=your_project_id
OPENAI_API_KEY=your_openai_api_key
# or GOOGLE_API_KEY=your_google_api_key
PORT=8787
HOST=127.0.0.1
ALLOWLIST=example.com,test.com
```

**Frontend Environment Variables:**
```env
NEXT_PUBLIC_SERVER_URL=http://127.0.0.1:8787
```

### Running the Application
```bash
# Start the backend server
cd server
pnpm dev

# Start the frontend (in a new terminal)
cd web
pnpm dev
```

## 🔧 Development

### Scripts
- **Backend**: `pnpm dev` (development), `pnpm build` (build), `pnpm start` (production)
- **Frontend**: `pnpm dev` (development), `pnpm build` (build), `pnpm start` (production)

### Key Technologies
- **TypeScript**: Full type safety across the stack
- **Tailwind CSS**: Utility-first CSS framework
- **Fastify**: High-performance Node.js web framework
- **Next.js 15**: Latest React framework with App Router
- **React 19**: Latest React version with modern hooks

## 📝 License

This project is private and proprietary.

---

This codebase represents a sophisticated web automation platform that combines cutting-edge AI capabilities with robust session recording and replay functionality, all wrapped in a modern, responsive user interface.
