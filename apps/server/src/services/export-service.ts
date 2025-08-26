import { ProjectModel } from '../models/project.js'
import { logger } from '../utils/logger.js'
import { marked } from 'marked'
import puppeteer from 'puppeteer'
import fs from 'fs/promises'
import path from 'path'

export interface ExportOptions {
  format: 'pdf' | 'html' | 'markdown'
  includeMetadata?: boolean
  includeConversations?: boolean
  customStyles?: string
}

export interface ExportResult {
  success: boolean
  filePath?: string
  fileName?: string
  error?: string
}

export class ExportService {
  private static readonly EXPORT_DIR = path.join(process.cwd(), 'exports')
  
  /**
   * Initialize export directory
   */
  static async initialize() {
    try {
      await fs.mkdir(this.EXPORT_DIR, { recursive: true })
      logger.info('Export service initialized')
    } catch (error) {
      logger.error('Failed to initialize export service:', error)
      throw error
    }
  }
  
  /**
   * Export project in specified format
   */
  static async exportProject(
    projectId: string,
    userId: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      const project = await ProjectModel.findById(projectId, userId)
      if (!project) {
        return { success: false, error: 'Project not found' }
      }
      
      const metadata = ProjectModel.getProjectMetadata(project)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const baseFileName = `${project.title.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}`
      
      switch (options.format) {
        case 'markdown':
          return await this.exportMarkdown(project, metadata, baseFileName, options)
        case 'html':
          return await this.exportHTML(project, metadata, baseFileName, options)
        case 'pdf':
          return await this.exportPDF(project, metadata, baseFileName, options)
        default:
          return { success: false, error: 'Unsupported export format' }
      }
    } catch (error) {
      logger.error('Export failed:', error)
      return { success: false, error: 'Export failed' }
    }
  }
  
  /**
   * Export as Markdown
   */
  private static async exportMarkdown(
    project: any,
    metadata: any,
    baseFileName: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      let content = ''
      
      // Add metadata header if requested
      if (options.includeMetadata) {
        content += `---\n`
        content += `title: ${project.title}\n`
        content += `created: ${project.createdAt.toISOString()}\n`
        content += `updated: ${project.updatedAt.toISOString()}\n`
        content += `status: ${project.status}\n`
        content += `word_count: ${metadata.wordCount}\n`
        content += `estimated_read_time: ${metadata.estimatedReadTime} minutes\n`
        if (metadata.tags.length > 0) {
          content += `tags: [${metadata.tags.join(', ')}]\n`
        }
        if (metadata.targetAudience) {
          content += `target_audience: ${metadata.targetAudience}\n`
        }
        content += `---\n\n`
      }
      
      // Add title
      content += `# ${project.title}\n\n`
      
      // Add main content
      content += project.content
      
      // Add conversations if requested
      if (options.includeConversations && project.conversations) {
        content += '\n\n---\n\n## AI Conversations\n\n'
        
        for (const conversation of project.conversations) {
          const agentName = this.getAgentDisplayName(conversation.agentType)
          content += `### ${agentName} Session\n\n`
          
          for (const message of conversation.messages) {
            const role = message.role === 'USER' ? 'You' : agentName
            content += `**${role}:** ${message.content}\n\n`
          }
        }
      }
      
      const fileName = `${baseFileName}.md`
      const filePath = path.join(this.EXPORT_DIR, fileName)
      
      await fs.writeFile(filePath, content, 'utf-8')
      
      return {
        success: true,
        filePath,
        fileName
      }
    } catch (error) {
      logger.error('Markdown export failed:', error)
      return { success: false, error: 'Markdown export failed' }
    }
  }
  
  /**
   * Export as HTML
   */
  private static async exportHTML(
    project: any,
    metadata: any,
    baseFileName: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      // Convert markdown to HTML
      const htmlContent = marked(project.content)
      
      // Create full HTML document
      let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${project.title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            color: #333;
        }
        h1, h2, h3, h4, h5, h6 {
            color: #2c3e50;
            margin-top: 2rem;
        }
        h1 {
            border-bottom: 2px solid #3498db;
            padding-bottom: 0.5rem;
        }
        code {
            background-color: #f8f9fa;
            padding: 0.2rem 0.4rem;
            border-radius: 3px;
            font-family: 'Monaco', 'Consolas', monospace;
        }
        pre {
            background-color: #f8f9fa;
            padding: 1rem;
            border-radius: 5px;
            overflow-x: auto;
        }
        blockquote {
            border-left: 4px solid #3498db;
            margin: 1rem 0;
            padding-left: 1rem;
            color: #666;
        }
        .metadata {
            background-color: #f8f9fa;
            padding: 1rem;
            border-radius: 5px;
            margin-bottom: 2rem;
            font-size: 0.9rem;
        }
        .conversations {
            margin-top: 3rem;
            padding-top: 2rem;
            border-top: 2px solid #eee;
        }
        .conversation {
            margin-bottom: 2rem;
            padding: 1rem;
            background-color: #f8f9fa;
            border-radius: 5px;
        }
        .message {
            margin-bottom: 1rem;
            padding: 0.5rem;
        }
        .message.user {
            background-color: #e3f2fd;
            border-left: 4px solid #2196f3;
        }
        .message.agent {
            background-color: #f3e5f5;
            border-left: 4px solid #9c27b0;
        }
        ${options.customStyles || ''}
    </style>
</head>
<body>`
      
      // Add metadata if requested
      if (options.includeMetadata) {
        html += `
    <div class="metadata">
        <h2>Document Information</h2>
        <p><strong>Created:</strong> ${project.createdAt.toLocaleDateString()}</p>
        <p><strong>Last Updated:</strong> ${project.updatedAt.toLocaleDateString()}</p>
        <p><strong>Status:</strong> ${project.status}</p>
        <p><strong>Word Count:</strong> ${metadata.wordCount}</p>
        <p><strong>Estimated Read Time:</strong> ${metadata.estimatedReadTime} minutes</p>
        ${metadata.tags.length > 0 ? `<p><strong>Tags:</strong> ${metadata.tags.join(', ')}</p>` : ''}
        ${metadata.targetAudience ? `<p><strong>Target Audience:</strong> ${metadata.targetAudience}</p>` : ''}
    </div>`
      }
      
      // Add main content
      html += `
    <h1>${project.title}</h1>
    ${htmlContent}`
      
      // Add conversations if requested
      if (options.includeConversations && project.conversations) {
        html += `
    <div class="conversations">
        <h2>AI Conversations</h2>`
        
        for (const conversation of project.conversations) {
          const agentName = this.getAgentDisplayName(conversation.agentType)
          html += `
        <div class="conversation">
            <h3>${agentName} Session</h3>`
          
          for (const message of conversation.messages) {
            const role = message.role === 'USER' ? 'user' : 'agent'
            const displayName = message.role === 'USER' ? 'You' : agentName
            html += `
            <div class="message ${role}">
                <strong>${displayName}:</strong> ${message.content}
            </div>`
          }
          
          html += `
        </div>`
        }
        
        html += `
    </div>`
      }
      
      html += `
</body>
</html>`
      
      const fileName = `${baseFileName}.html`
      const filePath = path.join(this.EXPORT_DIR, fileName)
      
      await fs.writeFile(filePath, html, 'utf-8')
      
      return {
        success: true,
        filePath,
        fileName
      }
    } catch (error) {
      logger.error('HTML export failed:', error)
      return { success: false, error: 'HTML export failed' }
    }
  }
  
  /**
   * Export as PDF
   */
  private static async exportPDF(
    project: any,
    metadata: any,
    baseFileName: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    let browser: puppeteer.Browser | null = null
    
    try {
      // First generate HTML
      const htmlResult = await this.exportHTML(project, metadata, `${baseFileName}_temp`, options)
      if (!htmlResult.success || !htmlResult.filePath) {
        return { success: false, error: 'Failed to generate HTML for PDF conversion' }
      }
      
      // Launch Puppeteer
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })
      
      const page = await browser.newPage()
      
      // Load HTML file
      await page.goto(`file://${htmlResult.filePath}`, {
        waitUntil: 'networkidle0'
      })
      
      // Generate PDF
      const fileName = `${baseFileName}.pdf`
      const filePath = path.join(this.EXPORT_DIR, fileName)
      
      await page.pdf({
        path: filePath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '1in',
          right: '1in',
          bottom: '1in',
          left: '1in'
        }
      })
      
      // Clean up temporary HTML file
      await fs.unlink(htmlResult.filePath)
      
      return {
        success: true,
        filePath,
        fileName
      }
    } catch (error) {
      logger.error('PDF export failed:', error)
      return { success: false, error: 'PDF export failed' }
    } finally {
      if (browser) {
        await browser.close()
      }
    }
  }
  
  /**
   * Get display name for agent type
   */
  private static getAgentDisplayName(agentType: string): string {
    const names = {
      IDEATION: 'Ideation Assistant',
      REFINER: 'Draft Refiner',
      MEDIA: 'Media Assistant',
      FACTCHECKER: 'Fact Checker'
    }
    return names[agentType as keyof typeof names] || agentType
  }
  
  /**
   * Clean up old export files
   */
  static async cleanupOldExports(maxAgeHours = 24) {
    try {
      const files = await fs.readdir(this.EXPORT_DIR)
      const now = Date.now()
      const maxAge = maxAgeHours * 60 * 60 * 1000
      
      for (const file of files) {
        const filePath = path.join(this.EXPORT_DIR, file)
        const stats = await fs.stat(filePath)
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath)
          logger.info(`Cleaned up old export file: ${file}`)
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup old exports:', error)
    }
  }
  
  /**
   * Get export file
   */
  static async getExportFile(fileName: string): Promise<Buffer | null> {
    try {
      const filePath = path.join(this.EXPORT_DIR, fileName)
      return await fs.readFile(filePath)
    } catch (error) {
      logger.error('Failed to read export file:', error)
      return null
    }
  }
}