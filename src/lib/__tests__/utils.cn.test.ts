import { describe, it, expect } from 'vitest';
import { cn } from '../utils';

describe('cn', () => {
	it('merges class names and resolves tailwind conflicts', () => {
		const result = cn('p-2', 'text-sm', 'p-4', { hidden: false, block: true });
		expect(result).toContain('text-sm');
		expect(result).toContain('block');
		// tailwind-merge should keep the last padding class
		expect(result).toContain('p-4');
		expect(result).not.toContain('p-2');
	});

	it('ignores falsy values', () => {
		const result = cn(undefined as unknown as string, null as unknown as string, '', false && 'x', 'y');
		expect(result).toBe('y');
	});
});

