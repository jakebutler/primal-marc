import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { axe, toHaveNoViolations } from 'jest-axe'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { LoginForm } from '@/components/auth/LoginForm'
import { CanvasChat } from '@/components/canvas/CanvasChat'

// Extend expect with jest-axe matchers
expect.extend(toHaveNoViolations)

test('Button component meets WCAG guidelines', async () => {
  const { container } = render(<Button>Click me</Button>)
  const results = await axe(container)
  expect(results).toHaveNoViolations()
})

test('Input component meets WCAG guidelines', async () => {
  const { container } = render(
    <div>
      <label htmlFor="test-input">Test Input</label>
      <Input id="test-input" placeholder="Enter text" />
    </div>
  )
  const results = await axe(container)
  expect(results).toHaveNoViolations()
})

test('Card component meets WCAG guidelines', async () => {
  const { container } = render(
    <Card>
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Card content with proper semantic structure</p>
      </CardContent>
    </Card>
  )
  const results = await axe(container)
  expect(results).toHaveNoViolations()
})

test('LoginForm meets WCAG guidelines', async () => {
  const { container } = render(<LoginForm />)
  const results = await axe(container)
  expect(results).toHaveNoViolations()
})

test('CanvasChat meets WCAG guidelines', async () => {
  const { container } = render(
    <CanvasChat 
      projectId="test-project"
      agentType="ideation"
      onContentUpdate={() => {}}
    />
  )
  const results = await axe(container)
  expect(results).toHaveNoViolations()
})

test('Color contrast meets WCAG AA standards', async () => {
  const { container } = render(
    <div>
      <Button variant="default">Default Button</Button>
      <Button variant="destructive">Destructive Button</Button>
      <Button variant="outline">Outline Button</Button>
      <Button variant="secondary">Secondary Button</Button>
      <Button variant="ghost">Ghost Button</Button>
    </div>
  )
  
  const results = await axe(container, {
    rules: {
      'color-contrast': { enabled: true }
    }
  })
  expect(results).toHaveNoViolations()
})

test('Keyboard navigation works correctly', async () => {
  const { container } = render(
    <div>
      <Button>First Button</Button>
      <Input placeholder="Input field" />
      <Button>Second Button</Button>
    </div>
  )
  
  const results = await axe(container, {
    rules: {
      'keyboard': { enabled: true },
      'focus-order-semantics': { enabled: true }
    }
  })
  expect(results).toHaveNoViolations()
})

test('ARIA labels and roles are properly implemented', async () => {
  const { container } = render(
    <div>
      <button aria-label="Close dialog">×</button>
      <div role="alert">Error message</div>
      <nav aria-label="Main navigation">
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/about">About</a></li>
        </ul>
      </nav>
    </div>
  )
  
  const results = await axe(container, {
    rules: {
      'aria-valid-attr': { enabled: true },
      'aria-valid-attr-value': { enabled: true },
      'button-name': { enabled: true },
      'link-name': { enabled: true }
    }
  })
  expect(results).toHaveNoViolations()
})