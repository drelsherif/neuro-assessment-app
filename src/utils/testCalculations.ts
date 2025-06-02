import { NormalizedLandmark } from '@mediapipe/tasks-vision';

// --- Gaze Calculation ---
const LEFT_IRIS_INDICES = [473, 474, 475, 476, 477];
const RIGHT_IRIS_INDICES = [468, 469, 470, 471, 472];

// FIX: Added 'export' and the function itself
export const calculateGazePosition = (landmarks: NormalizedLandmark[]) => {
    const getCenterPoint = (indices: number[]) => {
        const points = indices.map(index => landmarks[index]);
        if (points.some(p => !p)) return null;
        const sumX = points.reduce((acc, curr) => acc + curr.x, 0);
        const sumY = points.reduce((acc, curr) => acc + curr.y, 0);
        return { x: sumX / indices.length, y: sumY / indices.length };
    };

    const leftIrisCenter = getCenterPoint(LEFT_IRIS_INDICES);
    const rightIrisCenter = getCenterPoint(RIGHT_IRIS_INDICES);
    let averageGaze = null;
    if (leftIrisCenter && rightIrisCenter) {
        averageGaze = {
            x: (leftIrisCenter.x + rightIrisCenter.x) / 2,
            y: (leftIrisCenter.y + rightIrisCenter.y) / 2,
        };
    }
    return { left: leftIrisCenter, right: rightIrisCenter, average: averageGaze };
};

// --- Finger Tap Calculation ---

// FIX: Added the 'export' keyword before 'const'
export const calculateFingerTapDistance = (landmarks: NormalizedLandmark[]): number | null => {
    if (!landmarks || landmarks.length < 9) {
        return null;
    }
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const distance = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
    return distance;
};

// This function was already correct
export const analyzeTapData = (timestamps: number[]) => {
    if (timestamps.length < 2) {
        return { totalTaps: timestamps.length, tapsPerSecond: 0, averageTimeBetweenTaps: 0, consistency: 0 };
    }
    const totalTaps = timestamps.length;
    const duration = (timestamps[totalTaps - 1] - timestamps[0]) / 1000;
    const tapsPerSecond = totalTaps / duration;
    const intervals = [];
    for (let i = 1; i < totalTaps; i++) {
        intervals.push(timestamps[i] - timestamps[i - 1]);
    }
    const averageTimeBetweenTaps = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const mean = averageTimeBetweenTaps;
    const squaredDifferences = intervals.map(interval => Math.pow(interval - mean, 2));
    const avgSquaredDiff = squaredDifferences.reduce((sum, val) => sum + val, 0) / intervals.length;
    const consistency = Math.sqrt(avgSquaredDiff);

    return {
        totalTaps,
        tapsPerSecond: parseFloat(tapsPerSecond.toFixed(2)),
        averageTimeBetweenTaps: parseFloat(averageTimeBetweenTaps.toFixed(2)),
        consistency: parseFloat(consistency.toFixed(2)),
    };
};