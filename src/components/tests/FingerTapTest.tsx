import React, { useState, useRef, useCallback, useEffect } from 'react';
// ... (imports remain the same)
import { ResultsVisualization } from '../data/ResultsVisualization'; // We will create this component

// Define a shape for our final results
interface TapTestResults {
    totalTaps: number;
    tapsPerSecond: number;
    averageTimeBetweenTaps: number; // in milliseconds
    consistency: number; // A measure of rhythm (standard deviation)
}

const FingerTapTest: React.FC = () => {
    // ... (landmarker, isLoading, videoRef, etc. remain the same)
    const [isTestRunning, setIsTestRunning] = useState(false);
    const [wasTapped, setWasTapped] = useState(false);
    
    // NEW: State to store raw tap timestamps
    const [tapTimestamps, setTapTimestamps] = useState<number[]>([]);
    
    // NEW: State to hold the final, analyzed results
    const [testResults, setTestResults] = useState<TapTestResults | null>(null);

    // ... (enableWebcam remains the same)

    const predictWebcam = useCallback(() => {
        // ... (initial setup in predictWebcam is the same)
        const handLandmarker = landmarker as HandLandmarker;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const results: HandLandmarkerResult = handLandmarker.detectForVideo(video, performance.now());

        if (ctx) {
            drawHandLandmarks(ctx, results, canvas.width, canvas.height);

            if (isTestRunning && results.landmarks && results.landmarks.length > 0) {
                const distance = calculateFingerTapDistance(results.landmarks[0]);
                
                if (distance !== null) {
                    if (distance < TAP_THRESHOLD) {
                        if (!wasTapped) {
                            // NEW: Record timestamp instead of just counting
                            setTapTimestamps(prev => [...prev, performance.now()]);
                            setWasTapped(true);
                        }
                    } else {
                        setWasTapped(false);
                    }
                }
            }
        }
        requestRef.current = requestAnimationFrame(predictWebcam);
    }, [landmarker, isTestRunning, wasTapped]);

    const handleStartTest = () => {
        setTapTimestamps([]); // Reset data
        setTestResults(null); // Clear previous results
        setIsTestRunning(true);
    };

    const handleStopTest = () => {
        setIsTestRunning(false);
        // NEW: Analyze the collected data
        if (tapTimestamps.length > 1) {
            const results = analyzeTapData(tapTimestamps);
            setTestResults(results);
            console.log("Test Finished. Analyzed Results:", results);
        }
    };

    // ... (useEffect for cleanup remains the same)

    return (
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
            <div style={{ position: 'relative', width: VIDEO_WIDTH, height: VIDEO_HEIGHT }}>
                {/* ... (video and canvas elements are the same) ... */}
                <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, background: 'rgba(255,255,255,0.7)', padding: '10px', borderRadius: '5px' }}>
                    <h3>Finger Tap Test</h3>
                    {/* ... (buttons remain the same) ... */}
                    {isTestRunning && <h2>Taps: {tapTimestamps.length}</h2>}
                </div>
            </div>
            {/* NEW: Display results */}
            {testResults && (
                <ResultsVisualization title="Finger Tap Results" data={testResults} />
            )}
        </div>
    );
};