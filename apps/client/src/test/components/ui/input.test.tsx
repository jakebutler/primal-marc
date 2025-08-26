import { render, screen, fireEvent } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { Input } from '@/components/ui/input'

test('Input renders with correct placeholder', () => {
  render(<Input placeholder="Enter text" />)
  expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
})

test('Input handles value changes', () => {
  const handleChange = vi.fn()
  render(<Input onChange={handleChange} />)
  
  const input = screen.getByRole('textbox')
  fireEvent.change(input, { target: { value: 'test value' } })
  
  expect(handleChange).toHaveBeenCalled()
})

test('Input applies custom className', () => {
  render(<Input className="custom-class" />)
  const input = screen.getByRole('textbox')
  expect(input).toHaveClass('custom-class')
})

test('Input is disabled when disabled prop is true', () => {
  render(<Input disabled />)
  const input = screen.getByRole('textbox')
  expect(input).toBeDisabled()
})

test('Input accepts different types', () => {
  render(<Input type="email" />)
  const input = screen.getByRole('textbox')
  expect(input).toHaveAttribute('type', 'email')
})

test('Input forwards ref correctly', () => {
  const ref = vi.fn()
  render(<Input ref={ref} />)
  expect(ref).toHaveBeenCalled()
})