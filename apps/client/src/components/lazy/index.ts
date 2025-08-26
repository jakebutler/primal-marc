// Lazy loaded page components
import { withLazyLoading, preloadComponent } from '@/utils/lazy-loading'

// Main pages
export const LazyHomePage = withLazyLoading(
  () => import('@/pages/HomePage'),
  { loadingMessage: 'Loading home page...' }
)

export const LazyAuthPage = withLazyLoading(
  () => import('@/pages/AuthPage'),
  { loadingMessage: 'Loading authentication...' }
)

export const LazyDashboardPage = withLazyLoading(
  () => import('@/pages/DashboardPage'),
  { loadingMessage: 'Loading dashboard...' }
)

export const LazyProjectEditorPage = withLazyLoading(
  () => import('@/pages/ProjectEditorPage'),
  { loadingMessage: 'Loading project editor...' }
)

export const LazyCanvasDemoPage = withLazyLoading(
  () => import('@/pages/CanvasDemoPage'),
  { loadingMessage: 'Loading canvas demo...' }
)

// Heavy components that should be lazy loaded
export const LazyMarkdownEditor = withLazyLoading(
  () => import('@/components/editor/MarkdownEditor'),
  { loadingMessage: 'Loading editor...' }
)

export const LazyCanvasChat = withLazyLoading(
  () => import('@/components/canvas/CanvasChat'),
  { loadingMessage: 'Loading chat interface...' }
)

export const LazyProjectOrganizer = withLazyLoading(
  () => import('@/components/organization/ProjectOrganizer'),
  { loadingMessage: 'Loading project organizer...' }
)

export const LazyAdvancedSearch = withLazyLoading(
  () => import('@/components/search/AdvancedSearch'),
  { loadingMessage: 'Loading search...' }
)

export const LazyExportDialog = withLazyLoading(
  () => import('@/components/export/ExportDialog'),
  { loadingMessage: 'Loading export options...' }
)

export const LazyMobileTestSuite = withLazyLoading(
  () => import('@/components/mobile/MobileTestSuite'),
  { loadingMessage: 'Loading mobile test suite...' }
)

// Preload critical components
export function preloadCriticalComponents() {
  // Preload dashboard since it's likely the next page after auth
  preloadComponent(() => import('@/pages/DashboardPage'))
  
  // Preload editor components since they're core to the app
  preloadComponent(() => import('@/components/editor/MarkdownEditor'))
  preloadComponent(() => import('@/components/canvas/CanvasChat'))
}

// Preload components based on user interaction
export function preloadOnHover(componentImport: () => Promise<any>) {
  return {
    onMouseEnter: () => preloadComponent(componentImport),
    onFocus: () => preloadComponent(componentImport)
  }
}