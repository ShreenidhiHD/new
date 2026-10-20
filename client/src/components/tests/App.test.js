import React from 'react';
import { render, screen } from '@testing-library/react';
import App from '../App';

test('renders the OpenGrid playground', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'OpenGrid' })).toBeInTheDocument();
    expect(screen.getByRole('grid', { name: 'Commodity trades' })).toBeInTheDocument();
});
