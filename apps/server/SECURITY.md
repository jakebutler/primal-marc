# Security Implementation Guide

This document outlines the comprehensive security measures implemented in Primal Marc to protect against common vulnerabilities and ensure data safety.

## Security Features Overview

### 1. Input Validation and Sanitization

#### Comprehensive Request Validation
- **Zod Schema Validation**: All API endpoints use strict Zod schemas for request validation
- **Content Sanitization**: HTML content is sanitized using DOMPurify to prevent XSS attacks
- **File Upload Validation**: File type, size, and name validation for uploads
- **Query Parameter Sanitization**: Automatic sanitization of URL parameters

#### Implementation Details
```typescript
// Example validation schema
const secureValidationSchemas = {
  userRegistration: z.object({
    email: z.string().email().max(254).toLowerCase().trim(),
    password: z.string()
      .min(8).max(128)
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, 
        'Password must contain uppercase, lowercase, number and special character'),
    firstName: z.string().min(1).max(50).regex(/^[a-zA-Z\s'-]+$/).trim(),
    lastName: z.string().min(1).max(50).regex(/^[a-zA-Z\s'-]+$/).trim()
  })
}
```

### 2. Rate Limiting

#### Multi-Tier Rate Limiting
- **General API**: 100 requests per 15 minutes per IP
- **Authentication**: 10 attempts per 15 minutes per IP
- **AI Agent Requests**: 5 requests per minute per user (cost-aware)
- **File Uploads**: 5 uploads per minute per user
- **Search**: 30 requests per minute per user

#### AI-Specific Cost-Aware Rate Limiting
```typescript
// AI Agent Rate Limiter with budget controls
const aiAgentRateLimit = new AIAgentRateLimiter({
  maxRequestsPerMinute: 5,
  maxDailyCost: 1.0, // $1 per day per user
  estimatedCostPerRequest: 0.02 // $0.02 per request
})
```

### 3. Audit Logging

#### Comprehensive Event Tracking
All user actions and system events are logged for security monitoring:

- **Authentication Events**: Login, logout, registration, password reset
- **Content Operations**: Create, update, delete, view projects
- **AI Interactions**: All AI agent requests and responses
- **Security Events**: Rate limit violations, suspicious activity, unauthorized access
- **System Events**: File uploads, exports, search queries

#### Audit Log Structure
```typescript
interface AuditLogEntry {
  eventType: AuditEventType
  userId?: string
  ipAddress?: string
  userAgent?: string
  resource?: string
  resourceId?: string
  details?: Record<string, any>
  timestamp: Date
  success: boolean
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}
```

#### Suspicious Activity Detection
The system automatically detects patterns that may indicate malicious activity:
- Multiple failed login attempts
- Unusual IP address patterns
- High-frequency requests
- Rate limit violations
- Content filter violations

### 4. Content Filtering

#### AI Content Safety
All user inputs and AI outputs are filtered for inappropriate content:

- **Profanity Detection**: Basic profanity filtering with customizable word lists
- **Hate Speech Detection**: Pattern-based detection of hate speech
- **Violence Detection**: Identification of violent content
- **Personal Information**: Detection and redaction of PII (SSN, credit cards, emails, addresses)
- **Malicious Code**: Detection of script injection attempts
- **Spam Detection**: Pattern recognition for spam content

#### Content Filter Implementation
```typescript
const filterResult = await contentFilter.filterContent(content, {
  userId: req.user?.id,
  contentType: 'user_input',
  strictMode: true
})

if (!filterResult.allowed) {
  // Block content and log security event
  await auditLogger.logSecurityEvent(
    AuditEventType.SUSPICIOUS_ACTIVITY,
    req,
    'HIGH',
    { violations: filterResult.violations }
  )
}
```

### 5. CSRF Protection

#### Token-Based CSRF Protection
- **Token Generation**: Cryptographically secure CSRF tokens with HMAC signatures
- **Token Validation**: Automatic validation for state-changing requests
- **Session Integration**: CSRF tokens tied to user sessions
- **Cookie Security**: Secure cookie configuration with SameSite protection

#### CSRF Implementation
```typescript
// Generate CSRF token
const csrfToken = CSRFProtection.generateToken(sessionId)

// Verify CSRF token
const isValid = CSRFProtection.verifyToken(token, sessionId)
```

### 6. Security Headers

#### Comprehensive Security Headers
- **Content Security Policy (CSP)**: Strict CSP to prevent XSS attacks
- **HTTP Strict Transport Security (HSTS)**: Force HTTPS connections
- **X-Frame-Options**: Prevent clickjacking attacks
- **X-Content-Type-Options**: Prevent MIME type sniffing
- **X-XSS-Protection**: Enable browser XSS protection
- **Referrer Policy**: Control referrer information leakage
- **Permissions Policy**: Restrict browser features

#### CSP Configuration
```typescript
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: https: blob:",
  "connect-src 'self' https://api.openai.com https://api.promptlayer.com wss:",
  "frame-src 'none'",
  "object-src 'none'"
].join('; ')
```

## Security Testing

### Automated Security Tests
The application includes comprehensive security tests covering:

1. **Input Validation Tests**
   - Invalid email format rejection
   - Weak password rejection
   - HTML content sanitization
   - Oversized content rejection
   - Query parameter sanitization

2. **Rate Limiting Tests**
   - Authentication endpoint limits
   - AI agent request limits
   - Rate limit header verification

3. **CSRF Protection Tests**
   - Token generation and validation
   - POST request protection
   - GET request allowance

4. **Content Filtering Tests**
   - Profanity detection
   - Hate speech detection
   - Personal information detection
   - Malicious code detection
   - AI output filtering

5. **Audit Logging Tests**
   - Authentication event logging
   - AI interaction logging
   - Suspicious activity detection

### Vulnerability Assessment
Regular security assessments cover:

- **SQL Injection Prevention**: Verified through Prisma ORM usage
- **XSS Prevention**: Content sanitization and CSP implementation
- **Authentication Security**: Secure password hashing and session management
- **Data Exposure Prevention**: Proper error handling without sensitive data leakage
- **Denial of Service Prevention**: Request size limits and rate limiting

## Security Configuration

### Environment Variables
```bash
# Security Configuration
JWT_SECRET=your-jwt-secret-here
CSRF_SECRET=your-csrf-secret-here
SESSION_SECRET=your-session-secret-here

# Production Security
NODE_ENV=production
HTTPS_ONLY=true
SECURE_COOKIES=true
```

### Database Security
- **SQLite File Permissions**: Restricted file system permissions
- **Connection Security**: Encrypted connections where applicable
- **Data Encryption**: Sensitive data encrypted at rest
- **Backup Security**: Encrypted backups with integrity checks

### API Security
- **Authentication Required**: All sensitive endpoints require authentication
- **Authorization Checks**: Resource ownership verification
- **Request Validation**: Comprehensive input validation
- **Response Filtering**: Sensitive data filtering in responses

## Incident Response

### Security Event Handling
1. **Automatic Detection**: Real-time monitoring of security events
2. **Risk Assessment**: Automatic risk scoring of security incidents
3. **Alert System**: Immediate alerts for critical security events
4. **Audit Trail**: Complete audit trail for forensic analysis

### Response Procedures
1. **Immediate Response**: Automatic blocking of suspicious IPs
2. **Investigation**: Detailed analysis of security events
3. **Mitigation**: Implementation of additional security measures
4. **Recovery**: System recovery and security hardening

## Security Maintenance

### Regular Security Tasks
- **Dependency Updates**: Regular updates of security-critical dependencies
- **Security Patches**: Prompt application of security patches
- **Log Review**: Regular review of security logs and audit trails
- **Penetration Testing**: Periodic security assessments

### Monitoring and Alerting
- **Real-time Monitoring**: Continuous monitoring of security events
- **Automated Alerts**: Immediate alerts for security violations
- **Dashboard**: Security dashboard for monitoring system health
- **Reporting**: Regular security reports and metrics

## Best Practices

### Development Security
1. **Secure Coding**: Follow secure coding practices
2. **Code Review**: Security-focused code reviews
3. **Testing**: Comprehensive security testing
4. **Documentation**: Maintain security documentation

### Operational Security
1. **Access Control**: Strict access controls for production systems
2. **Monitoring**: Continuous security monitoring
3. **Incident Response**: Well-defined incident response procedures
4. **Training**: Regular security training for development team

### User Security
1. **Password Policy**: Strong password requirements
2. **Session Management**: Secure session handling
3. **Data Protection**: User data protection and privacy
4. **Security Education**: User security awareness

## Compliance and Standards

### Security Standards
- **OWASP Top 10**: Protection against OWASP Top 10 vulnerabilities
- **Security Headers**: Implementation of security headers best practices
- **Data Protection**: GDPR-compliant data handling
- **Audit Requirements**: Comprehensive audit logging

### Regular Assessments
- **Security Audits**: Regular security audits and assessments
- **Vulnerability Scanning**: Automated vulnerability scanning
- **Penetration Testing**: Professional penetration testing
- **Compliance Reviews**: Regular compliance reviews and updates

This security implementation provides comprehensive protection against common web application vulnerabilities while maintaining usability and performance. Regular reviews and updates ensure the security measures remain effective against evolving threats.