import React, { useState, useRef, useCallback, useEffect } from 'react';
import useMediaPipe, { drawFaceLandmarks } from '../../hooks/useMediaPipe';
import { calculateGazePosition } from '../../utils/testCalculations';
import { FaceLandmarker, FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import { ResultsVisualization } from '../data/ResultsVisualization';

const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;

interface GazeDataPoint { timestamp: number; target: { x: number; y: number }; gaze: { x: number; y: number } | null; }
interface GazeTestResults { trackingScore: number; pointsCollected: number; }

const EyeTrackingTest: React.FC = () => {
    const { landmarker, isLoading } = useMediaPipe('face');
    const [isTestRunning, setIsTestRunning] = useState(false);
    const [gazeHistory, setGazeHistory] = useState<GazeDataPoint[]>([]);
    const [testResults, setTestResults] = useState<GazeTestResults | null>(null);
    const [isWebcamEnabled, setIsWebcamEnabled] = useState(false);
    const [targetPosition, setTargetPosition] = useState({ x: 0.5, y: 0.5 });

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | null>(null);

    const predictWebcam = useCallback(() => {
        if (!videoRef.current || !canvasRef.current || !landmarker || !videoRef.current.srcObject) {
            return;
        }
        const faceLandmarker = landmarker as FaceLandmarker;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (video.readyState >= 2 && ctx) {
            const results: FaceLandmarkerResult = faceLandmarker.detectForVideo(video, performance.now());
            drawFaceLandmarks(ctx, results, canvas.width, canvas.height);

            ctx.beginPath();
            ctx.arc(targetPosition.x * canvas.width, targetPosition.y * canvas.height, 15, 0, 2 * Math.PI);
            ctx.fillStyle = 'yellow';
            ctx.fill();

            if (results.faceLandmarks.length > 0) {
                const gaze = calculateGazePosition(results.faceLandmarks[0]);
                if (gaze.average) {
                    ctx.beginPath();
                    ctx.arc(gaze.average.x * canvas.width, gaze.average.y * canvas.height, 7, 0, 2 * Math.PI);
                    ctx.fillStyle = 'red';
                    ctx.fill();
                    if (isTestRunning) {
                        setGazeHistory(prev => [...prev, { timestamp: performance.now(), target: targetPosition, gaze: gaze.average }]);
                    }
                }
            }
        }
        requestRef.current = requestAnimationFrame(predictWebcam);
    }, [landmarker, isTestRunning, targetPosition]);

    const enableWebcam = async () => {
        if (!landmarker) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadeddata = () => {
                    setIsWebcamEnabled(true);
                    requestRef.current = requestAnimationFrame(predictWebcam);
                };
            }
        } catch (err) {
            console.error("Error accessing webcam:", err);
        }
    };

    const handleStartTest = () => {
        setGazeHistory([]);
        setTestResults(null);
        setIsTestRunning(true);
    };

    const handleStopTest = () => {
        setIsTestRunning(false);
        if (gazeHistory.length > 0) {
            let totalDistance = 0, validPoints = 0;
            gazeHistory.forEach(point => {
                if (point.gaze) {
                    totalDistance += Math.hypot(point.target.x - point.gaze.x, point.target.y - point.gaze.y);
                    validPoints++;
                }
            });
            const averageError = totalDistance / validPoints;
            const trackingScore = Math.max(0, 100 - (averageError * 100));
            setTestResults({ trackingScore: parseFloat(trackingScore.toFixed(2)), pointsCollected: validPoints });
        }
    };

    useEffect(() => {
        let animationFrameId: number;
        if (isTestRunning) {
            const animateTarget = () => {
                const time = performance.now() / 3000;
                setTargetPosition({ x: 0.5 + 0.4 * Math.cos(time), y: 0.5 + 0.4 * Math.sin(time) });
                animationFrameId = requestAnimationFrame(animateTarget);
            };
            animateTarget();
        }
        return () => { cancelAnimationFrame(animationFrameId) };
    }, [isTestRunning]);

    useEffect(() => {
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            if (videoRef.current && videoRef.current.srcObject) {
                (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', width: '100%' }}>
            <div style={{ position: 'relative', width: '90vw', maxWidth: '640px', aspectRatio: '640 / 480', border: '2px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
                <video ref={videoRef} autoPlay playsInline style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                <canvas ref={canvasRef} width={VIDEO_WIDTH} height={VIDEO_HEIGHT} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, transform: 'scaleX(-1)' }} />
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