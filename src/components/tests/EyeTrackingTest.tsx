import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useMediaPipe, drawFaceLandmarks } from '../../hooks/useMediaPipe';
import { calculateGazePosition } from '../../utils/testCalculations';
import { FaceLandmarkerResult } from '@mediapipe/tasks-vision';

const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;

const EyeTrackingTest: React.FC = () => {
    const { faceLandmarker, isLoading } = useMediaPipe();
    const [isTestRunning, setIsTestRunning] = useState(false);
    const [testResults, setTestResults] = useState<any[]>([]);
    const [targetPosition, setTargetPosition] = useState({ x: 0.5, y: 0.5 }); // Normalized coordinates (0 to 1)

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | null>(null);

    // Function to start the webcam
    const enableWebcam = async () => {
        if (!faceLandmarker) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.addEventListener('loadeddata', predictWebcam);
            }
        } catch (err) {
            console.error("Error accessing webcam:", err);
        }
    };

    // The main animation loop
    const predictWebcam = useCallback(() => {
        if (!videoRef.current || !canvasRef.current || !faceLandmarker) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (video.readyState < 2) {
            requestRef.current = requestAnimationFrame(predictWebcam);
            return;
        }

        const startTimeMs = performance.now();
        const results: FaceLandmarkerResult = faceLandmarker.detectForVideo(video, startTimeMs);

        if (ctx) {
            // Draw the face mesh for visual feedback
            drawFaceLandmarks(ctx, results, canvas.width, canvas.height);

            // Draw the moving target
            ctx.beginPath();
            ctx.arc(targetPosition.x * canvas.width, targetPosition.y * canvas.height, 10, 0, 2 * Math.PI);
            ctx.fillStyle = 'yellow';
            ctx.fill();

            // If we have landmarks, calculate and draw the user's gaze
            if (results.faceLandmarks.length > 0) {
                const gaze = calculateGazePosition(results.faceLandmarks[0]);
                if (gaze.average) {
                    ctx.beginPath();
                    ctx.arc(gaze.average.x * canvas.width, gaze.average.y * canvas.height, 5, 0, 2 * Math.PI);
                    ctx.fillStyle = 'lime';
                    ctx.fill();
                }

                // If the test is running, record the data
                if (isTestRunning) {
                   // In a real scenario, you'd calculate deviation here
                   // For now, we just store positions
                    setTestResults(prev => [...prev, {
                        timestamp: startTimeMs,
                        target: targetPosition,
                        gaze: gaze.average
                    }]);
                }
            }
        }

        requestRef.current = requestAnimationFrame(predictWebcam);
    }, [faceLandmarker, isTestRunning, targetPosition]);


    // Effect to update the target's position during the test
    useEffect(() => {
        if (!isTestRunning) return;

        // Simple circular motion for the target
        const interval = setInterval(() => {
            const time = performance.now() / 2000; // Slow down the movement
            const x = 0.5 + 0.4 * Math.cos(time);
            const y = 0.5 + 0.4 * Math.sin(time);
            setTargetPosition({ x, y });
        }, 50); // Update target position every 50ms

        return () => clearInterval(interval);
    }, [isTestRunning]);


    const handleStartTest = () => {
        setTestResults([]);
        setIsTestRunning(true);
    };

    const handleStopTest = () => {
        setIsTestRunning(false);
        // Here you would process the `testResults` array
        console.log("Test Finished. Results:", testResults);
    };

    return (
        <div style={{ position: 'relative', width: VIDEO_WIDTH, height: VIDEO_HEIGHT }}>
            <h3>Eye Movement (Smooth Pursuit) Test</h3>
            <video ref={videoRef} autoPlay playsInline style={{ position: 'absolute', top: 0, left: 0, transform: 'scaleX(-1)' }}></video>
            <canvas ref={canvasRef} width={VIDEO_WIDTH} height={VIDEO_HEIGHT} style={{ position: 'absolute', top: 0, left: 0 }} />

            <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10 }}>
                {isLoading && <p>Loading Model...</p>}
                {!faceLandmarker && !isLoading && <p>Model failed to load.</p>}

                <button onClick={enableWebcam} disabled={!faceLandmarker || !!videoRef.current?.srcObject}>
                    Enable Webcam
                </button>
                <button onClick={handleStartTest} disabled={!videoRef.current?.srcObject || isTestRunning}>
                    Start Test
                </button>
                <button onClick={handleStopTest} disabled={!isTestRunning}>
                    Stop Test
                </button>
            </div>
        </div>
    );
};

export default EyeTrackingTest;