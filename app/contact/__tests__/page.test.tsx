import { render, screen, fireEvent } from '@testing-library/react'
import Contact from '../page'

describe('Contact Page', () => {
  it('renders contact form', () => {
    render(<Contact />)

    expect(screen.getByText('Contact Us')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Message')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send Message' })).toBeInTheDocument()
  })

  it('allows form input', () => {
    render(<Contact />)

    const nameInput = screen.getByLabelText('Name')
    const emailInput = screen.getByLabelText('Email')
    const messageInput = screen.getByLabelText('Message')

    fireEvent.change(nameInput, { target: { value: 'John Doe' } })
    fireEvent.change(emailInput, { target: { value: 'john@example.com' } })
    fireEvent.change(messageInput, { target: { value: 'Hello world' } })

    expect(nameInput).toHaveValue('John Doe')
    expect(emailInput).toHaveValue('john@example.com')
    expect(messageInput).toHaveValue('Hello world')
  })

  it('submits form', () => {
    const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {})
    render(<Contact />)

    const nameInput = screen.getByLabelText('Name')
    const emailInput = screen.getByLabelText('Email')
    const messageInput = screen.getByLabelText('Message')
    const submitButton = screen.getByRole('button', { name: 'Send Message' })

    fireEvent.change(nameInput, { target: { value: 'John Doe' } })
    fireEvent.change(emailInput, { target: { value: 'john@example.com' } })
    fireEvent.change(messageInput, { target: { value: 'Hello world' } })
    fireEvent.click(submitButton)

    expect(alertMock).toHaveBeenCalledWith('Thank you for your message!')
    alertMock.mockRestore()
  })
})