import React, { useState, useRef, useCallback, useEffect } from 'react';
import useMediaPipe, { drawFaceLandmarks } from '../../hooks/useMediaPipe';
import { calculateGazePosition } from '../../utils/testCalculations';
import { FaceLandmarker, FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import { ResultsVisualization } from '../data/ResultsVisualization';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement,
    LineElement, Title, Tooltip, Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;
const TEST_DURATION = 10000; // 10 seconds

interface GazeDataPoint { timestamp: number; target: { x: number; y: number }; gaze: { x: number; y: number } | null; }
interface GazeTestResults { trackingScore: number; pointsCollected: number; }

const EyeTrackingTest: React.FC = () => {
    const { landmarker, isLoading } = useMediaPipe('face');
    const [isWebcamEnabled, setIsWebcamEnabled] = useState(false);
    const [instructionsVisible, setInstructionsVisible] = useState(true);
    const [isTestRunning, setIsTestRunning] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [gazeHistory, setGazeHistory] = useState<GazeDataPoint[]>([]);
    const [testResults, setTestResults] = useState<GazeTestResults | null>(null);
    const [targetPosition, setTargetPosition] = useState({ x: 0.5, y: 0.5 });
    const [chartData, setChartData] = useState<any>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | null>(null);
    const testTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    const predictWebcam = useCallback(() => {
        if (!videoRef.current || !canvasRef.current || !landmarker || !videoRef.current.srcObject) {
            requestRef.current = requestAnimationFrame(predictWebcam);
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
    
    const handleStopTest = useCallback(() => {
        setIsTestRunning(false);
        setTimeLeft(0);
        if (testTimeoutRef.current) clearTimeout(testTimeoutRef.current);

        setGazeHistory(currentGazeHistory => {
            if (currentGazeHistory.length > 0) {
                let totalDistance = 0, validPoints = 0;
                currentGazeHistory.forEach(point => {
                    if (point.gaze) {
                        totalDistance += Math.hypot(point.target.x - point.gaze.x, point.target.y - point.gaze.y);
                        validPoints++;
                    }
                });
                const averageError = totalDistance / validPoints;
                const trackingScore = Math.max(0, 100 - (averageError * 150));
                setTestResults({ trackingScore: parseFloat(trackingScore.toFixed(2)), pointsCollected: validPoints });
                
                setChartData({
                    datasets: [
                        { label: 'Target Path', data: currentGazeHistory.map(p => ({ x: p.target.x, y: p.target.y })), borderColor: 'rgb(255, 204, 0)', showLine: true, pointRadius: 1 },
                        { label: 'Gaze Path', data: currentGazeHistory.map(p => p.gaze ? { x: p.gaze.x, y: p.gaze.y } : null).filter(p => p), borderColor: 'rgb(255, 0, 0)', showLine: true, pointRadius: 1 },
                    ],
                });
            }
            return currentGazeHistory;
        });
    }, []);

    const handleStartTest = () => {
        setInstructionsVisible(false);
        setGazeHistory([]);
        setTestResults(null);
        setChartData(null);
        setIsTestRunning(true);
        setTimeLeft(TEST_DURATION / 1000);

        requestRef.current = requestAnimationFrame(predictWebcam);
        testTimeoutRef.current = setTimeout(handleStopTest, TEST_DURATION);
    };

    const enableWebcamAndStart = async () => {
        if (!landmarker || isWebcamEnabled) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadeddata = () => {
                    setIsWebcamEnabled(true);
                    handleStartTest();
                };
            }
        } catch (err) {
            console.error("Error accessing webcam:", err);
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
        if (isTestRunning && timeLeft > 0) {
            const timerId = setInterval(() => {
                setTimeLeft(prevTime => Math.max(0, prevTime - 1));
            }, 1000);
            return () => clearInterval(timerId);
        }
    }, [isTestRunning, timeLeft]);

    useEffect(() => {
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            if (testTimeoutRef.current) clearTimeout(testTimeoutRef.current);
            if (videoRef.current?.srcObject) {
                (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    if (instructionsVisible) {
        return (
            <div className="card">
                <h2>Eye Tracking Test Instructions</h2>
                <p>A yellow dot will appear and move around the screen for <strong>10 seconds</strong>.</p>
                <p>Keep your head still and follow the dot with your eyes only.</p>
                <button className="primary-button" onClick={enableWebcamAndStart} disabled={isLoading}>
                    {isLoading ? "Loading Model..." : "Start 10 Second Test"}
                </button>
            </div>
        );
    }
    
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', width: '100%' }}>
            <div style={{ position: 'relative', width: '90vw', maxWidth: '640px', aspectRatio: '640 / 480', border: '2px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
                <video ref={videoRef} autoPlay playsInline style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                <canvas ref={canvasRef} width={VIDEO_WIDTH} height={VIDEO_HEIGHT} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, transform: 'scaleX(-1)' }} />
                <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, background: 'rgba(0,0,0,0.5)', color: 'white', padding: '10px 15px', borderRadius: '8px', fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {timeLeft > 0 ? `Time Left: ${timeLeft}` : "Test Finished"}
                </div>
            </div>
            {testResults && chartData && (
                <div style={{ display: 'flex', gap: '2rem', width: '90%', maxWidth: '1000px', alignItems: 'stretch' }}>
                    <ResultsVisualization title="Eye Tracking Results" data={testResults} />
                    <div className="card" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <h3>Gaze vs Target Path</h3>
                        <Line data={chartData} options={{ scales: { x: { type: 'linear', min: 0, max: 1 }, y: { type: 'linear', min: 0, max: 1 } }, animation: { duration: 0 } }}/>
                    </div>
                </div>
            )}
        </div>
    );
};
export default EyeTrackingTest;