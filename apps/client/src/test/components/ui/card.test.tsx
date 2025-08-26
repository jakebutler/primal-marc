import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'

test('Card renders children correctly', () => {
  render(
    <Card>
      <div>Card content</div>
    </Card>
  )
  expect(screen.getByText('Card content')).toBeInTheDocument()
})

test('CardHeader renders with correct styling', () => {
  render(
    <CardHeader>
      <div>Header content</div>
    </CardHeader>
  )
  const header = screen.getByText('Header content').parentElement
  expect(header).toHaveClass('flex', 'flex-col', 'space-y-1.5', 'p-6')
})

test('CardTitle renders as h3 by default', () => {
  render(<CardTitle>Test Title</CardTitle>)
  const title = screen.getByRole('heading', { level: 3 })
  expect(title).toHaveTextContent('Test Title')
})

test('CardDescription has correct styling', () => {
  render(<CardDescription>Test description</CardDescription>)
  const description = screen.getByText('Test description')
  expect(description).toHaveClass('text-sm', 'text-muted-foreground')
})

test('CardContent has correct padding', () => {
  render(
    <CardContent>
      <div>Content</div>
    </CardContent>
  )
  const content = screen.getByText('Content').parentElement
  expect(content).toHaveClass('p-6', 'pt-0')
})

test('CardFooter has correct styling', () => {
  render(
    <CardFooter>
      <div>Footer</div>
    </CardFooter>
  )
  const footer = screen.getByText('Footer').parentElement
  expect(footer).toHaveClass('flex', 'items-center', 'p-6', 'pt-0')
})

test('Complete Card structure renders correctly', () => {
  render(
    <Card>
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card Description</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Card content goes here</p>
      </CardContent>
      <CardFooter>
        <button>Action</button>
      </CardFooter>
    </Card>
  )
  
  expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Card Title')
  expect(screen.getByText('Card Description')).toBeInTheDocument()
  expect(screen.getByText('Card content goes here')).toBeInTheDocument()
  expect(screen.getByRole('button')).toHaveTextContent('Action')
})