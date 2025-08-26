import { logger } from '../utils/logger.js'

export interface ContentFilterResult {
  allowed: boolean
  filtered: boolean
  filteredContent?: string
  violations: ContentViolation[]
  riskScore: number
}

export interface ContentViolation {
  type: ViolationType
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  description: string
  location?: {
    start: number
    end: number
  }
}

export enum ViolationType {
  PROFANITY = 'PROFANITY',
  HATE_SPEECH = 'HATE_SPEECH',
  VIOLENCE = 'VIOLENCE',
  SEXUAL_CONTENT = 'SEXUAL_CONTENT',
  HARASSMENT = 'HARASSMENT',
  SPAM = 'SPAM',
  PERSONAL_INFO = 'PERSONAL_INFO',
  MALICIOUS_CODE = 'MALICIOUS_CODE',
  COPYRIGHT = 'COPYRIGHT',
  MISINFORMATION = 'MISINFORMATION'
}

export class ContentFilter {
  private profanityWords: Set<string>
  private hateSpeechPatterns: RegExp[]
  private personalInfoPatterns: RegExp[]
  private maliciousCodePatterns: RegExp[]

  constructor() {
    this.initializeFilters()
  }

  private initializeFilters(): void {
    // Basic profanity filter (expandable)
    this.profanityWords = new Set([
      // Add common profanity words here
      'damn', 'hell', 'shit', 'fuck', 'bitch', 'asshole', 'bastard'
      // Note: In production, use a comprehensive profanity list
    ])

    // Hate speech patterns
    this.hateSpeechPatterns = [
      /\b(kill|murder|die)\s+(all\s+)?(jews|muslims|christians|blacks|whites|gays|women|men)\b/gi,
      /\b(hate|despise)\s+(all\s+)?(jews|muslims|christians|blacks|whites|gays|women|men)\b/gi,
      /\b(nazi|hitler|genocide|ethnic\s+cleansing)\b/gi
    ]

    // Personal information patterns
    this.personalInfoPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
      /\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/g, // Credit card
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
      /\b\d{3}-\d{3}-\d{4}\b/g, // Phone number
      /\b\d{1,5}\s\w+\s(street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd)\b/gi // Address
    ]

    // Malicious code patterns
    this.maliciousCodePatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi, // Event handlers
      /eval\s*\(/gi,
      /document\.cookie/gi,
      /window\.location/gi,
      /\$\(.*\)\.html\(/gi // jQuery HTML injection
    ]
  }

  /**
   * Filter content and return analysis
   */
  async filterContent(content: string, context?: {
    userId?: string
    contentType?: 'user_input' | 'ai_output' | 'comment'
    strictMode?: boolean
  }): Promise<ContentFilterResult> {
    const violations: ContentViolation[] = []
    let riskScore = 0
    let filteredContent = content

    // Check for profanity
    const profanityViolations = this.checkProfanity(content)
    violations.push(...profanityViolations)
    riskScore += profanityViolations.length * 10

    // Check for hate speech
    const hateSpeechViolations = this.checkHateSpeech(content)
    violations.push(...hateSpeechViolations)
    riskScore += hateSpeechViolations.length * 50

    // Check for violence
    const violenceViolations = this.checkViolence(content)
    violations.push(...violenceViolations)
    riskScore += violenceViolations.length * 30

    // Check for personal information
    const personalInfoViolations = this.checkPersonalInfo(content)
    violations.push(...personalInfoViolations)
    riskScore += personalInfoViolations.length * 25

    // Check for malicious code
    const maliciousCodeViolations = this.checkMaliciousCode(content)
    violations.push(...maliciousCodeViolations)
    riskScore += maliciousCodeViolations.length * 40

    // Check for spam patterns
    const spamViolations = this.checkSpam(content)
    violations.push(...spamViolations)
    riskScore += spamViolations.length * 15

    // Apply filtering based on violations
    if (violations.length > 0) {
      filteredContent = this.applyFiltering(content, violations)
    }

    // Determine if content should be allowed
    const criticalViolations = violations.filter(v => v.severity === 'CRITICAL')
    const highViolations = violations.filter(v => v.severity === 'HIGH')
    
    const allowed = criticalViolations.length === 0 && 
                   (context?.strictMode ? highViolations.length === 0 : highViolations.length < 3)

    // Log filtering results
    if (violations.length > 0) {
      logger.warn('Content filtering violations detected', {
        userId: context?.userId,
        contentType: context?.contentType,
        violationCount: violations.length,
        riskScore,
        allowed,
        violations: violations.map(v => ({ type: v.type, severity: v.severity }))
      })
    }

    return {
      allowed,
      filtered: filteredContent !== content,
      filteredContent: filteredContent !== content ? filteredContent : undefined,
      violations,
      riskScore
    }
  }

  private checkProfanity(content: string): ContentViolation[] {
    const violations: ContentViolation[] = []
    const words = content.toLowerCase().split(/\s+/)

    for (let i = 0; i < words.length; i++) {
      const word = words[i].replace(/[^\w]/g, '')
      if (this.profanityWords.has(word)) {
        violations.push({
          type: ViolationType.PROFANITY,
          severity: 'LOW',
          description: `Profanity detected: "${word}"`
        })
      }
    }

    return violations
  }

  private checkHateSpeech(content: string): ContentViolation[] {
    const violations: ContentViolation[] = []

    for (const pattern of this.hateSpeechPatterns) {
      const matches = content.match(pattern)
      if (matches) {
        for (const match of matches) {
          violations.push({
            type: ViolationType.HATE_SPEECH,
            severity: 'CRITICAL',
            description: `Hate speech detected: "${match}"`
          })
        }
      }
    }

    return violations
  }

  private checkViolence(content: string): ContentViolation[] {
    const violations: ContentViolation[] = []
    const violencePatterns = [
      /\b(kill|murder|assassinate|torture|bomb|shoot|stab|strangle)\b/gi,
      /\b(violence|violent|brutal|savage|bloodshed)\b/gi,
      /\b(weapon|gun|knife|explosive|poison)\s+(to|for|against)\b/gi
    ]

    for (const pattern of violencePatterns) {
      const matches = content.match(pattern)
      if (matches) {
        for (const match of matches) {
          violations.push({
            type: ViolationType.VIOLENCE,
            severity: 'HIGH',
            description: `Violence-related content detected: "${match}"`
          })
        }
      }
    }

    return violations
  }

  private checkPersonalInfo(content: string): ContentViolation[] {
    const violations: ContentViolation[] = []

    for (const pattern of this.personalInfoPatterns) {
      const matches = content.match(pattern)
      if (matches) {
        for (const match of matches) {
          violations.push({
            type: ViolationType.PERSONAL_INFO,
            severity: 'HIGH',
            description: `Personal information detected: "${match.substring(0, 10)}..."`
          })
        }
      }
    }

    return violations
  }

  private checkMaliciousCode(content: string): ContentViolation[] {
    const violations: ContentViolation[] = []

    for (const pattern of this.maliciousCodePatterns) {
      const matches = content.match(pattern)
      if (matches) {
        for (const match of matches) {
          violations.push({
            type: ViolationType.MALICIOUS_CODE,
            severity: 'CRITICAL',
            description: `Malicious code detected: "${match.substring(0, 20)}..."`
          })
        }
      }
    }

    return violations
  }

  private checkSpam(content: string): ContentViolation[] {
    const violations: ContentViolation[] = []

    // Check for excessive repetition
    const words = content.split(/\s+/)
    const wordCount = new Map<string, number>()
    
    for (const word of words) {
      const cleanWord = word.toLowerCase().replace(/[^\w]/g, '')
      if (cleanWord.length > 2) {
        wordCount.set(cleanWord, (wordCount.get(cleanWord) || 0) + 1)
      }
    }

    for (const [word, count] of wordCount.entries()) {
      if (count > Math.max(5, words.length * 0.1)) {
        violations.push({
          type: ViolationType.SPAM,
          severity: 'MEDIUM',
          description: `Excessive repetition of word: "${word}" (${count} times)`
        })
      }
    }

    // Check for excessive capitalization
    const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length
    if (capsRatio > 0.5 && content.length > 20) {
      violations.push({
        type: ViolationType.SPAM,
        severity: 'LOW',
        description: 'Excessive capitalization detected'
      })
    }

    // Check for excessive punctuation
    const punctRatio = (content.match(/[!?]{2,}/g) || []).length
    if (punctRatio > 3) {
      violations.push({
        type: ViolationType.SPAM,
        severity: 'LOW',
        description: 'Excessive punctuation detected'
      })
    }

    return violations
  }

  private applyFiltering(content: string, violations: ContentViolation[]): string {
    let filtered = content

    for (const violation of violations) {
      switch (violation.type) {
        case ViolationType.PROFANITY:
          // Replace profanity with asterisks
          for (const word of this.profanityWords) {
            const regex = new RegExp(`\\b${word}\\b`, 'gi')
            filtered = filtered.replace(regex, '*'.repeat(word.length))
          }
          break

        case ViolationType.PERSONAL_INFO:
          // Redact personal information
          for (const pattern of this.personalInfoPatterns) {
            filtered = filtered.replace(pattern, '[REDACTED]')
          }
          break

        case ViolationType.MALICIOUS_CODE:
          // Remove malicious code entirely
          for (const pattern of this.maliciousCodePatterns) {
            filtered = filtered.replace(pattern, '[REMOVED]')
          }
          break

        case ViolationType.HATE_SPEECH:
        case ViolationType.VIOLENCE:
          // For critical violations, mark for manual review
          if (violation.severity === 'CRITICAL') {
            filtered = '[CONTENT FLAGGED FOR REVIEW]'
          }
          break
      }
    }

    return filtered
  }

  /**
   * Check if content is safe for AI processing
   */
  async isSafeForAI(content: string): Promise<boolean> {
    const result = await this.filterContent(content, {
      contentType: 'user_input',
      strictMode: true
    })

    return result.allowed && result.riskScore < 50
  }

  /**
   * Filter AI-generated content before returning to user
   */
  async filterAIOutput(content: string, userId?: string): Promise<string> {
    const result = await this.filterContent(content, {
      userId,
      contentType: 'ai_output',
      strictMode: false
    })

    if (!result.allowed) {
      logger.error('AI generated inappropriate content', {
        userId,
        riskScore: result.riskScore,
        violations: result.violations.length
      })
      
      return 'I apologize, but I cannot provide that content as it may violate our content policy. Please try rephrasing your request.'
    }

    return result.filteredContent || content
  }

  /**
   * Get content filter statistics
   */
  getFilterStats(): {
    profanityWords: number
    hateSpeechPatterns: number
    personalInfoPatterns: number
    maliciousCodePatterns: number
  } {
    return {
      profanityWords: this.profanityWords.size,
      hateSpeechPatterns: this.hateSpeechPatterns.length,
      personalInfoPatterns: this.personalInfoPatterns.length,
      maliciousCodePatterns: this.maliciousCodePatterns.length
    }
  }
}

// Export singleton instance
export const contentFilter = new ContentFilter()