# Technical Plan - VANTAGE Lead Intelligence Platform

## Project Overview

The VANTAGE platform is a lead intelligence system built with Next.js that handles business discovery, website analysis, and lead scoring. The project includes:
- **UI Components**: AppShell, Button, Input, Select, Tabs, Tooltip
- **Data Layer**: Mock leads, business intelligence metrics, automation configurations
- **Type Definitions**: Comprehensive TypeScript interfaces for leads, businesses, websites
- **Configuration**: Next.js, Tailwind CSS, TypeScript setup

## Component Architecture Analysis

### Core Application Shell (`src/components/app/AppShell.tsx`)
- Manages main layout with Sidebar, Topbar, and main content area
- Handles responsive behavior (collapsible sidebar, mobile open state)
- Uses Tailwind CSS for styling

### UI Components
| Component | Purpose | Key Features |
|-----------|----------|--------------|
| **Button** | Interactive action buttons | Variants (primary, secondary, outline, ghost, danger), sizing (sm/md/lg), loading states |
| **Input** | Text/form inputs | Labels, error/hint messaging, icon placement, validation support |
| **Select** | Dropdown selections | Options array, error handling, selection state |
| **Tabs** | Navigation panels | Multiple tab management (referenced in AppShell) |
| **Tooltip** | Helper text overlays | Positioned near icons, contextual guidance |

### Data Layer (`src/data/mockData.ts`)
- **MOCK_LEADS**: 10 sample leads with business details, opportunity scores, health status, and analysis metadata
- **MOCK_OVERVIEW_STATS**: Aggregate metrics (businesses discovered, websites analyzed, etc.)
- **MOCK_AUTOMATIONS**: 4 automated workflows (scoring, alerting, filtering, e-commerce detection)
- **MOCK_PROVIDERS**: External service descriptors (Foursquare, Yelp, PageSpeed, Groq, Cerebras, Together, OpenRouter, MiniMax, Pollinations, Resend)

### Type Definitions (`src/lib/types.ts`)
- **Lead**: Core entity with ID, business reference, opportunityScore (0-100), websiteHealth, status (discovered/analyzing/won/qualified), lastAnalyzedAt, reason
- **Business**: Company profile with name, category, location (GeoLocation), contact info, source, discoveredAt
- **WebsiteIntelligenceMetrics**: Performance, mobile, accessibility, SEO, security, conversion, booking, ecommerce scores
- **WebsiteHealth**: Classification (none/critical/poor/fair/good)
- **ScoreTier**: Exceptional/high/promising/moderate/low
- **DiscoverFilters**: Search criteria (category, country, region, city, websiteStatus, minScore, depth, maxResults)
- **ProviderDescriptor**: Pluggable external service configuration

### Configuration Files
- **package.json**: Next.js 14.2.5 + React 18.3.1, dependencies (clsx, next, react, react-dom) + devDependencies (typescript, tailwindcss, postcss, autoprefixer)
- **tailwind.config.ts**: Dark theme with custom color tokens (accent, foreground, success, warning, danger, info) and utility classes
- **tsconfig.json**: TypeScript strict mode configuration
- **next.config.mjs**: Next.js build/development settings
- **.env.example**: Environment variables template

## Technical Challenges & Opportunities

### 1. State Management
- The AppShell manages global state (sidebar collapsed/expanded, mobile open/closed) via React hooks
- UI components (Button, Input, Select) rely on `cn` helper from utils for consistent class composition
- Consider integrating Zustand or Redux for larger state needs

### 2. Data Layer
- Mock data is ready for production migration
- Scoring system (ScoreTier enum) and pipeline stages (PIPELINE_STAGES) are well-defined
- Web intelligence metrics provide rich analysis capabilities

### 3. UI Consistency
- All components use the same `cn` utility for class composition
- Tailwind CSS ensures consistent spacing, typography, and color scheme
- Responsive design handled in AppShell (mobile vs desktop layouts)

### 4. Extensibility
- Provider descriptor system enables easy addition of new external APIs
- Automation system (MOCK_AUTOMATIONS) can be extended with new workflow triggers

## Prioritized Implementation Plan

### Phase 1: Foundation & Core Components (Week 1-2)
1. **Verify AppShell functionality** - Ensure sidebar collapse/expand, mobile toggle work correctly
2. **Enhance UI components** - Add proper accessibility attributes, keyboard navigation, and loading states
3. **Update button variants** - Ensure all four variants (primary, secondary, outline, ghost, danger) render consistently
4. **Improve input validation** - Add controlled input handling and error display

### Phase 2: Data Integration (Week 2-3)
1. **Connect mock data to components** - Pass lead/business data to UI components where appropriate
2. **Implement scoring visualization** - Display opportunity scores and health status in UI
3. **Integrate web intelligence metrics** - Show performance, SEO, and conversion scores
4. **Add filter controls** - Expose DiscoverFilters interface to allow dynamic querying

### Phase 3: Automation & Analytics (Week 3-4)
1. **Deploy automation workflows** - Connect MOCK_AUTOMATIONS to actual processing pipelines
2. **Build overview dashboards** - Visualize MOCK_OVERVIEW_STATS and lead distribution
3. **Implement provider integrations** - Set up connections to external APIs (PageSpeed, Groq, etc.)
4. **Add tooltips and help** - Enhance UX with contextual tooltips

### Phase 4: Optimization & Production Readiness (Week 4-5)
1. **Performance optimizations** - Lazy loading, code splitting, memoization
2. **Testing coverage** - Unit tests for components and utility functions
3. **Documentation** - Update README, component docs, and developer guides
4. **CI/CD pipeline** - Automated builds and deployments

## Risk Mitigation

- **Component coupling**: Keep UI components decoupled from data sources; use dependency injection where possible
- **Mock data limitations**: Ensure production data migration strategy is documented
- **Performance**: Monitor bundle size and lazy-load heavy components
- **Accessibility**: Verify WCAG compliance for all interactive elements

## Success Metrics

- All UI components render consistently across browser resolutions
- Lead data displays correctly with proper scoring and health indicators
- Filtering and sorting work as expected
- Automation workflows execute without errors
- Response times under 200ms for UI interactions

---