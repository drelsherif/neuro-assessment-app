import React, { useState, useRef, useCallback, useEffect } from 'react';
import useMediaPipe, { drawHandLandmarks } from '../../hooks/useMediaPipe';
import { calculateFingerTapDistance, analyzeTapData } from '../../utils/testCalculations';
import { HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { ResultsVisualization } from '../data/ResultsVisualization';

// --- Constants ---
const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;
const TAP_THRESHOLD = 0.05; // Normalized distance between thumb and index finger to count as a 'tap'

// --- TypeScript Interfaces ---
interface TapTestResults {
    totalTaps: number;
    tapsPerSecond: number;
    averageTimeBetweenTaps: number;
    consistency: number;
}

const FingerTapTest: React.FC = () => {
    // --- State Management ---
    const { landmarker, isLoading } = useMediaPipe('hand');
    const [isTestRunning, setIsTestRunning] = useState(false);
    const [wasTapped, setWasTapped] = useState(false); // State to prevent multiple counts per single tap action
    const [tapTimestamps, setTapTimestamps] = useState<number[]>([]);
    const [testResults, setTestResults] = useState<TapTestResults | null>(null);
    const [isWebcamEnabled, setIsWebcamEnabled] = useState(false);

    // --- Refs for DOM elements and animation loop ---
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | null>(null);

    // --- Core Functions ---

    /**
     * Starts the user's webcam and connects it to the video element.
     */
    const enableWebcam = async () => {
        if (!landmarker) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.addEventListener('loadeddata', () => {
                    setIsWebcamEnabled(true);
                    predictWebcam(); // Start the detection loop
                });
            }
        } catch (err) {
            console.error("Error accessing webcam:", err);
            alert("Could not access webcam. Please ensure permissions are granted and try again.");
        }
    };

    /**
     * The main loop that runs on every animation frame to detect hands.
     */
    const predictWebcam = useCallback(() => {
        if (!videoRef.current || !canvasRef.current || !landmarker) {
            return;
        }

        const handLandmarker = landmarker as HandLandmarker;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (video.readyState < 2 || !ctx) {
            requestRef.current = requestAnimationFrame(predictWebcam);
            return;
        }

        // Detect hands in the current video frame
        const results: HandLandmarkerResult = handLandmarker.detectForVideo(video, performance.now());

        // Draw the landmarks on the canvas
        drawHandLandmarks(ctx, results, canvas.width, canvas.height);

        // If the test is running, perform tap analysis
        if (isTestRunning && results.landmarks && results.landmarks.length > 0) {
            const distance = calculateFingerTapDistance(results.landmarks[0]); // Analyze the first detected hand
            
            if (distance !== null) {
                // Check if fingers are close enough to be considered a 'tap'
                if (distance < TAP_THRESHOLD) {
                    if (!wasTapped) {
                        setTapTimestamps(prev => [...prev, performance.now()]);
                        setWasTapped(true); // Mark as tapped to avoid double counting
                    }
                } else {
                    setWasTapped(false); // Reset when fingers are apart
                }
            }
        }

        requestRef.current = requestAnimationFrame(predictWebcam);
    }, [landmarker, isTestRunning, wasTapped]);

    /**
     * Resets state and starts the test.
     */
    const handleStartTest = () => {
        setTapTimestamps([]);
        setTestResults(null);
        setIsTestRunning(true);
        // Optional: Add a timer for the test duration
    };

    /**
     * Stops the test and triggers the data analysis.
     */
    const handleStopTest = () => {
        setIsTestRunning(false);
        if (tapTimestamps.length > 1) {
            const finalResults = analyzeTapData(tapTimestamps);
            setTestResults(finalResults);
        }
    };

    // --- Lifecycle Hooks ---

    // Clean up the animation frame loop when the component unmounts
    useEffect(() => {
        return () => {
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }
        };
    }, []);

    // --- Rendered JSX ---
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
            <div style={{ position: 'relative', width: VIDEO_WIDTH, height: VIDEO_HEIGHT, border: '2px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
                <video ref={videoRef} autoPlay playsInline style={{ position: 'absolute', top: 0, left: 0, transform: 'scaleX(-1)', width: '100%', height: '100%' }} />
                <canvas ref={canvasRef} width={VIDEO_WIDTH} height={VIDEO_HEIGHT} style={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }} />
                
                <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, background: 'rgba(255,255,255,0.8)', padding: '10px', borderRadius: '5px' }}>
                    <h3>Finger Tap Test</h3>
                    {isLoading && <p>Loading Hand Model...</p>}
                    
                    {!isWebcamEnabled && (
                        <button onClick={enableWebcam} disabled={isLoading}>
                            Enable Webcam
                        </button>
                    )}
                    
                    {isWebcamEnabled && (
                        <>
                            <button onClick={handleStartTest} disabled={isTestRunning}>
                                Start Test
                            </button>
                            <button onClick={handleStopTest} disabled={!isTestRunning}>
                                Stop Test
                            </button>
                        </>
                    )}
                    
                    {isTestRunning && <h2 style={{ margin: '10px 0 0 0', color: '#007aff' }}>Taps: {tapTimestamps.length}</h2>}
                </div>
            </div>
            
            {testResults && (
                <ResultsVisualization title="Finger Tap Results" data={testResults} />
            )}
        </div>
    );
};

export default FingerTapTest;