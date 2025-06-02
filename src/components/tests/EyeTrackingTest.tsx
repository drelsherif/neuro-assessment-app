import React, { useState, useRef, useCallback, useEffect } from 'react';
import useMediaPipe, { drawFaceLandmarks } from '../../hooks/useMediaPipe';
import { calculateGazePosition } from '../../utils/testCalculations';
import { FaceLandmarker, FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import { ResultsVisualization } from '../data/ResultsVisualization';

// --- Constants ---
const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;

// --- TypeScript Interfaces ---
interface GazeDataPoint {
    timestamp: number;
    target: { x: number; y: number };
    gaze: { x: number; y: number } | null;
}
interface GazeTestResults {
    trackingScore: number;
    pointsCollected: number;
}

const EyeTrackingTest: React.FC = () => {
    // --- State Management ---
    const { landmarker, isLoading } = useMediaPipe('face');
    const [isTestRunning, setIsTestRunning] = useState(false);
    const [gazeHistory, setGazeHistory] = useState<GazeDataPoint[]>([]);
    const [testResults, setTestResults] = useState<GazeTestResults | null>(null);
    const [isWebcamEnabled, setIsWebcamEnabled] = useState(false);
    const [targetPosition, setTargetPosition] = useState({ x: 0.5, y: 0.5 });

    // --- Refs ---
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | null>(null);

    // --- Core Functions ---
    const enableWebcam = async () => {
        if (!landmarker) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.addEventListener('loadeddata', () => {
                    setIsWebcamEnabled(true);
                    predictWebcam();
                });
            }
        } catch (err) {
            console.error("Error accessing webcam:", err);
            alert("Could not access webcam. Please ensure permissions are granted and try again.");
        }
    };

    const predictWebcam = useCallback(() => {
        if (!videoRef.current || !canvasRef.current || !landmarker) {
            requestRef.current = requestAnimationFrame(predictWebcam);
            return;
        }

        const faceLandmarker = landmarker as FaceLandmarker;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (video.readyState < 2 || !ctx) {
            requestRef.current = requestAnimationFrame(predictWebcam);
            return;
        }

        const results: FaceLandmarkerResult = faceLandmarker.detectForVideo(video, performance.now());
        drawFaceLandmarks(ctx, results, canvas.width, canvas.height);

        // Draw the target dot
        ctx.beginPath();
        ctx.arc(targetPosition.x * canvas.width, targetPosition.y * canvas.height, 15, 0, 2 * Math.PI);
        ctx.fillStyle = 'yellow';
        ctx.fill();

        if (results.faceLandmarks.length > 0) {
            const gaze = calculateGazePosition(results.faceLandmarks[0]);
            if (gaze.average) {
                // Draw the user's gaze dot
                ctx.beginPath();
                ctx.arc(gaze.average.x * canvas.width, gaze.average.y * canvas.height, 7, 0, 2 * Math.PI);
                ctx.fillStyle = 'red';
                ctx.fill();
                
                if (isTestRunning) {
                    setGazeHistory(prev => [...prev, { timestamp: performance.now(), target: targetPosition, gaze: gaze.average }]);
                }
            }
        }
        requestRef.current = requestAnimationFrame(predictWebcam);
    }, [landmarker, isTestRunning, targetPosition]);

    const handleStartTest = () => {
        setGazeHistory([]);
        setTestResults(null);
        setIsTestRunning(true);
    };

    const handleStopTest = () => {
        setIsTestRunning(false);
        if (gazeHistory.length > 0) {
            // Simple analysis: calculate the average distance between target and gaze
            let totalDistance = 0;
            let validPoints = 0;
            gazeHistory.forEach(point => {
                if (point.gaze) {
                    const distance = Math.hypot(point.target.x - point.gaze.x, point.target.y - point.gaze.y);
                    totalDistance += distance;
                    validPoints++;
                }
            });
            const averageError = totalDistance / validPoints;
            // Convert error to a score (lower error = higher score). Max error is ~1.4, so 100 is a good multiplier.
            const trackingScore = Math.max(0, 100 - (averageError * 100)); 
            setTestResults({ trackingScore: parseFloat(trackingScore.toFixed(2)), pointsCollected: validPoints });
        }
    };

    // --- Lifecycle Hooks ---
    useEffect(() => {
        let animationFrameId: number;
        if (isTestRunning) {
            const animateTarget = () => {
                // Circular motion for the target
                const time = performance.now() / 3000; // Slower movement
                const x = 0.5 + 0.4 * Math.cos(time);
                const y = 0.5 + 0.4 * Math.sin(time);
                setTargetPosition({ x, y });
                animationFrameId = requestAnimationFrame(animateTarget);
            };
            animateTarget();
        }
        return () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [isTestRunning]);
    
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
            <div style={{ position: 'relative', width: VIDEO_WIDTH, height: VIDEO_HEIGHT, border: '2px solid #ccc', borderRadius: '8px', overflow: 'hidden', background: '#000' }}>
                <video ref={videoRef} autoPlay playsInline style={{ position: 'absolute', top: 0, left: 0, transform: 'scaleX(-1)', width: '100%', height: '100%', opacity: 0.5 }} />
                <canvas ref={canvasRef} width={VIDEO_WIDTH} height={VIDEO_HEIGHT} style={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }} />
                
                <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, background: 'rgba(255,255,255,0.8)', padding: '10px', borderRadius: '5px' }}>
                    <h3>Eye Tracking Test</h3>
                    {isLoading && <p>Loading Model...</p>}
                    {!isWebcamEnabled && <button onClick={enableWebcam} disabled={isLoading}>Enable Webcam</button>}
                    {isWebcamEnabled && (
                        <>
                            <button onClick={handleStartTest} disabled={isTestRunning}>Start Test</button>
                            <button onClick={handleStopTest} disabled={!isTestRunning}>Stop Test</button>
                        </>
                    )}
                </div>
            </div>
            {testResults && <ResultsVisualization title="Eye Tracking Results" data={testResults} />}
        </div>
    );
};

export default EyeTrackingTest;