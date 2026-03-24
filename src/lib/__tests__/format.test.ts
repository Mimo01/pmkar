import { beforeEach, describe, expect, it } from 'vitest';
import { useLanguageStore } from '../../i18n/languageStore';
import { formatDate, formatRelativeTime, formatTimestamp } from '../format';

describe('format utilities', () => {
  beforeEach(() => {
    // Use English locale for consistent test output
    useLanguageStore.setState({ language: 'en' });
  });

  describe('formatDate', () => {
    it('formats an ISO date string to readable English date', () => {
      const result = formatDate('2024-06-15T00:00:00.000Z');
      // en-US format: "June 15, 2024"
      expect(result).toMatch(/June\s+15,?\s+2024/);
    });

    it('accepts custom DateTimeFormat options', () => {
      const result = formatDate('2024-06-15T00:00:00.000Z', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      expect(result).toMatch(/Jun/i);
    });

    it('formats January date correctly', () => {
      const result = formatDate('2024-01-01T12:00:00.000Z');
      expect(result).toMatch(/January\s+1,?\s+2024/);
    });

    it('handles year boundary dates', () => {
      // Use noon UTC to avoid timezone-dependent date shifts
      const result = formatDate('2024-12-31T12:00:00.000Z');
      expect(result).toMatch(/December\s+31,?\s+2024/);
    });

    it('formats date in Slovak locale when language is sk', () => {
      useLanguageStore.setState({ language: 'sk' });
      const result = formatDate('2024-06-15T00:00:00.000Z');
      // sk-SK format includes day and month in Slovak
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('formatRelativeTime', () => {
    it('returns relative time string for a date in the past', () => {
      const pastDate = new Date(Date.now() - 2 * 60 * 1000).toISOString(); // 2 minutes ago
      const result = formatRelativeTime(pastDate);
      expect(result).toMatch(/minute/i);
    });

    it('returns seconds unit for very recent dates', () => {
      const recentDate = new Date(Date.now() - 30 * 1000).toISOString(); // 30 seconds ago
      const result = formatRelativeTime(recentDate);
      expect(result).toMatch(/second/i);
    });

    it('returns hours unit for dates a few hours ago', () => {
      const hoursAgo = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
      const result = formatRelativeTime(hoursAgo);
      expect(result).toMatch(/hour/i);
    });

    it('returns days unit for dates several days ago', () => {
      const daysAgo = new Date(Date.now() - 5 * 86400 * 1000).toISOString();
      const result = formatRelativeTime(daysAgo);
      expect(result).toMatch(/day/i);
    });

    it('returns a string type', () => {
      const result = formatRelativeTime(new Date().toISOString());
      expect(typeof result).toBe('string');
    });

    it('uses Slovak locale when language is sk', () => {
      useLanguageStore.setState({ language: 'sk' });
      const pastDate = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const result = formatRelativeTime(pastDate);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('formatTimestamp', () => {
    it('formats ISO timestamp to readable date+time string', () => {
      const result = formatTimestamp('2024-06-15T14:30:00.000Z');
      // Should contain month abbreviation
      expect(result).toMatch(/Jun/i);
    });

    it('includes year in the output', () => {
      const result = formatTimestamp('2024-06-15T14:30:00.000Z');
      expect(result).toContain('2024');
    });

    it('includes time in the output', () => {
      const result = formatTimestamp('2024-06-15T14:30:00.000Z');
      // Should contain some hour/minute notation
      expect(result).toMatch(/\d+:\d{2}/);
    });

    it('formats timestamp in Slovak locale when language is sk', () => {
      useLanguageStore.setState({ language: 'sk' });
      const result = formatTimestamp('2024-06-15T14:30:00.000Z');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('handles early morning timestamps', () => {
      const result = formatTimestamp('2024-01-01T00:00:00.000Z');
      expect(result).toContain('2024');
    });
  });
});
