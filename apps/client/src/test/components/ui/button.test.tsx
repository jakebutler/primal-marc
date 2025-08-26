import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { Button } from '@/components/ui/button'

test('Button renders with correct text', () => {
  render(<Button>Click me</Button>)
  expect(screen.getByRole('button')).toHaveTextContent('Click me')
})

test('Button handles click events', () => {
  const handleClick = vi.fn()
  render(<Button onClick={handleClick}>Click me</Button>)
  
  fireEvent.click(screen.getByRole('button'))
  expect(handleClick).toHaveBeenCalledTimes(1)
})

test('Button applies variant classes correctly', () => {
  render(<Button variant="destructive">Delete</Button>)
  const button = screen.getByRole('button')
  expect(button).toHaveClass('bg-destructive')
})

test('Button applies size classes correctly', () => {
  render(<Button size="sm">Small</Button>)
  const button = screen.getByRole('button')
  expect(button).toHaveClass('h-9')
})

test('Button is disabled when disabled prop is true', () => {
  render(<Button disabled>Disabled</Button>)
  const button = screen.getByRole('button')
  expect(button).toBeDisabled()
  expect(button).toHaveClass('disabled:pointer-events-none')
})

test('Button renders as child component when asChild is true', () => {
  render(
    <Button asChild>
      <a href="/test">Link Button</a>
    </Button>
  )
  const link = screen.getByRole('link')
  expect(link).toHaveAttribute('href', '/test')
})