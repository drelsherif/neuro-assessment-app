// ... (keep existing functions)

/**
 * Analyzes an array of tap timestamps to calculate speed and rhythm.
 * @param timestamps - An array of numbers representing the timestamp of each tap.
 * @returns An object with total taps, taps per second, average interval, and consistency.
 */
export const analyzeTapData = (timestamps: number[]) => {
    if (timestamps.length < 2) {
        return { totalTaps: timestamps.length, tapsPerSecond: 0, averageTimeBetweenTaps: 0, consistency: 0 };
    }

    const totalTaps = timestamps.length;
    const duration = (timestamps[totalTaps - 1] - timestamps[0]) / 1000; // in seconds
    const tapsPerSecond = totalTaps / duration;

    // Calculate the time intervals between taps
    const intervals = [];
    for (let i = 1; i < totalTaps; i++) {
        intervals.push(timestamps[i] - timestamps[i - 1]);
    }

    // Calculate average time between taps
    const averageTimeBetweenTaps = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;

    // Calculate consistency (standard deviation of intervals)
    const mean = averageTimeBetweenTaps;
    const squaredDifferences = intervals.map(interval => Math.pow(interval - mean, 2));
    const avgSquaredDiff = squaredDifferences.reduce((sum, val) => sum + val, 0) / intervals.length;
    const consistency = Math.sqrt(avgSquaredDiff);

    return {
        totalTaps,
        tapsPerSecond: parseFloat(tapsPerSecond.toFixed(2)),
        averageTimeBetweenTaps: parseFloat(averageTimeBetweenTaps.toFixed(2)),
        consistency: parseFloat(consistency.toFixed(2)), // Lower is better
    };
};