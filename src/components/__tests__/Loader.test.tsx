import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoadingScreen from '../Loader';

describe('LoadingScreen', () => {
	it('renders spinner and message', () => {
		const { container } = render(<LoadingScreen />);
		const message = screen.getByText('Generating your report...');
		expect(message).toBeInTheDocument();
		// lucide-react renders an <svg> icon
		const svg = container.querySelector('svg');
		expect(svg).toBeTruthy();
	});
});

