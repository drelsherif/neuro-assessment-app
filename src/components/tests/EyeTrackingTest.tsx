import React, { useState, useRef, useCallback, useEffect } from 'react';
import useMediaPipe, { drawFaceLandmarks } from '../../hooks/useMediaPipe';
import { calculateGazePosition } from '../../utils/testCalculations';
import { FaceLandmarker, FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import { ResultsVisualization } from '../data/ResultsVisualization';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;
const TEST_DURATION = 10000; // 10 seconds

interface GazeDataPoint { /* ...interface content... */ }
interface GazeTestResults { /* ...interface content... */ }

const EyeTrackingTest: React.FC = () => {
    const { landmarker, isLoading } = useMediaPipe('face');
    const [isWebcamEnabled, setIsWebcamEnabled] = useState(false);
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
            requestRef.current = requestAnimationFrame(predictWebcam); // Keep trying if not ready
            return;
        }
        const faceLandmarker = landmarker as FaceLandmarker;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (video.readyState >= 2 && ctx) {
            const results: FaceLandmarkerResult = faceLandmarker.detectForVideo(video, performance.now());
            
            ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas for eye tracking
            
            // Draw target dot
            ctx.beginPath();
            ctx.arc(targetPosition.x * canvas.width, targetPosition.y * canvas.height, 15, 0, 2 * Math.PI);
            ctx.fillStyle = 'yellow';
            ctx.fill();

            // Draw face landmarks and gaze dot
            if (results.faceLandmarks.length > 0) {
                drawFaceLandmarks(ctx, results, canvas.width, canvas.height);
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
    
    const handleStopTest = useCallback(() => { /* ...same as before... */ }, []);

    const handleStartTest = () => { /* ...same as before... */ };

    const enableWebcam = async () => {
        if (!landmarker || isWebcamEnabled) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                // Start predictWebcam loop immediately after stream is assigned
                requestRef.current = requestAnimationFrame(predictWebcam);
                setIsWebcamEnabled(true);
            }
        } catch (err) {
            console.error("Error accessing webcam:", err);
        }
    };
    
    useEffect(() => { /* ...same target animation effect... */ }, [isTestRunning]);
    useEffect(() => { /* ...same timer effect... */ }, [isTestRunning, timeLeft]);
    useEffect(() => {
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            if (testTimeoutRef.current) clearTimeout(testTimeoutRef.current);
            if (videoRef.current?.srcObject) {
                (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', width: '100%' }}>
            <div style={{ position: 'relative', width: '90vw', maxWidth: '640px', aspectRatio: '640 / 480', border: '2px solid #ccc', borderRadius: '8px', overflow: 'hidden', background: '#000' }}>
                <video ref={videoRef} autoPlay playsInline style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                <canvas ref={canvasRef} width={VIDEO_WIDTH} height={VIDEO_HEIGHT} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, transform: 'scaleX(-1)' }} />
                <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, background: 'rgba(0,0,0,0.5)', color: 'white', padding: '10px 15px', borderRadius: '8px', fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {isTestRunning ? `Time Left: ${timeLeft}` : (testResults ? "Test Finished" : (isWebcamEnabled ? "Ready" : "Waiting Webcam"))}
                </div>
            </div>
            <div className="card" style={{padding: '1rem'}}>
                <p>Follow the yellow dot with your eyes while keeping your head still.</p>
                {!isWebcamEnabled && <button className="primary-button" onClick={enableWebcam} disabled={isLoading}>{isLoading ? "Loading Model..." : "Enable Webcam"}</button>}
                {isWebcamEnabled && !isTestRunning && <button className="primary-button" onClick={handleStartTest}>Start 10 Second Test</button>}
                {isTestRunning && <p>Test in progress...</p>}
            </div>
            {testResults && chartData && ( /* ...results and chart JSX... */ )}
        </div>
    );
};
export default EyeTrackingTest;