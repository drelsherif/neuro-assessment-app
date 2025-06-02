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

interface GazeDataPoint { timestamp: number; target: { x: number; y: number }; gaze: { x: number; y: number } | null; }
interface GazeTestResults { trackingScore: number; pointsCollected: number; }

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
    const targetAnimationRef = useRef<number | null>(null);

    const predictWebcam = useCallback(() => {
        if (!videoRef.current || !canvasRef.current || !landmarker || !videoRef.current.srcObject) {
            if (requestRef.current !== null) requestRef.current = requestAnimationFrame(predictWebcam);
            return;
        }
        const faceLandmarker = landmarker as FaceLandmarker;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (video.readyState >= 2 && ctx) {
            const results: FaceLandmarkerResult = faceLandmarker.detectForVideo(video, performance.now());
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            ctx.beginPath();
            ctx.arc(targetPosition.x * canvas.width, targetPosition.y * canvas.height, 15, 0, 2 * Math.PI);
            ctx.fillStyle = 'yellow';
            ctx.fill();

            if (results.faceLandmarks.length > 0) {
                drawFaceLandmarks(ctx, results, canvas.width, canvas.height);
                const gaze = calculateGazePosition(results.faceLandmarks[0]);
                if (gaze.average) {
                    ctx.beginPath();
                    ctx.arc(gaze.average.x * canvas.width, gaze.average.y * canvas.height, 7, 0, 2 * Math.PI);
                    ctx.fillStyle = 'red';
                    ctx.fill();
                    if (isTestRunning) { // Check if test is running
                        // console.log('[EyeTrackingTest] predictWebcam - Test is running, adding to gazeHistory'); // DEBUG
                        setGazeHistory(prev => [...prev, { timestamp: performance.now(), target: targetPosition, gaze: gaze.average }]);
                    }
                }
            }
        }
        requestRef.current = requestAnimationFrame(predictWebcam);
    }, [landmarker, isTestRunning, targetPosition]);
    
    const handleStopTest = useCallback(() => {
        console.log('[EyeTrackingTest] handleStopTest called'); // DEBUG
        setIsTestRunning(false);
        setTimeLeft(0);
        if (testTimeoutRef.current) clearTimeout(testTimeoutRef.current);
        if (targetAnimationRef.current) cancelAnimationFrame(targetAnimationRef.current);

        setGazeHistory(currentGazeHistory => {
            console.log('[EyeTrackingTest] Gaze history at stop:', currentGazeHistory); // DEBUG
            if (currentGazeHistory.length > 0) {
                let totalDistance = 0, validPoints = 0;
                currentGazeHistory.forEach(point => {
                    if (point.gaze) {
                        totalDistance += Math.hypot(point.target.x - point.gaze.x, point.target.y - point.gaze.y);
                        validPoints++;
                    }
                });
                const averageError = validPoints > 0 ? totalDistance / validPoints : 0;
                const trackingScore = Math.max(0, 100 - (averageError * 150));
                setTestResults({ trackingScore: parseFloat(trackingScore.toFixed(2)), pointsCollected: validPoints });
                
                setChartData({
                    datasets: [
                        { label: 'Target Path', data: currentGazeHistory.map(p => ({ x: p.target.x, y: p.target.y })), borderColor: 'rgb(255, 204, 0)', backgroundColor: 'rgba(255, 204, 0, 0.1)', showLine: true, pointRadius: 1, tension: 0.1 },
                        { label: 'Gaze Path', data: currentGazeHistory.map(p => p.gaze ? { x: p.gaze.x, y: p.gaze.y } : null).filter(p => p), borderColor: 'rgb(255, 0, 0)', backgroundColor: 'rgba(255, 0, 0, 0.1)', showLine: true, pointRadius: 1, tension: 0.1 },
                    ],
                });
            } else {
                setTestResults({ trackingScore: 0, pointsCollected: 0 });
                setChartData(null);
            }
            return currentGazeHistory;
        });
    }, []);

    const handleStartTest = () => {
        console.log('[EyeTrackingTest] handleStartTest called'); // DEBUG
        setGazeHistory([]);
        setTestResults(null);
        setChartData(null);
        setIsTestRunning(true); // This should trigger effects
        setTimeLeft(TEST_DURATION / 1000);
        testTimeoutRef.current = setTimeout(handleStopTest, TEST_DURATION);
    };

    const enableWebcam = async () => {
        console.log('[EyeTrackingTest] enableWebcam called'); // DEBUG
        if (!landmarker || isWebcamEnabled) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                requestRef.current = requestAnimationFrame(predictWebcam);
                setIsWebcamEnabled(true);
                console.log('[EyeTrackingTest] Webcam enabled, predictWebcam loop started.'); // DEBUG
            }
        } catch (err) { console.error("Error accessing webcam:", err); }
    };
    
    useEffect(() => {
        // console.log(`[EyeTrackingTest] Target animation effect. isTestRunning: ${isTestRunning}`); // DEBUG
        if (isTestRunning) {
            const animateTarget = () => {
                const time = performance.now() / 3000;
                setTargetPosition({ x: 0.5 + 0.35 * Math.cos(time), y: 0.5 + 0.35 * Math.sin(time) });
                targetAnimationRef.current = requestAnimationFrame(animateTarget);
            };
            targetAnimationRef.current = requestAnimationFrame(animateTarget);
        } else {
            if (targetAnimationRef.current) {
                cancelAnimationFrame(targetAnimationRef.current);
            }
        }
        return () => { 
            if (targetAnimationRef.current) cancelAnimationFrame(targetAnimationRef.current);
        };
    }, [isTestRunning]);

    useEffect(() => {
        // console.log(`[EyeTrackingTest] Timer effect. isTestRunning: ${isTestRunning}, timeLeft: ${timeLeft}`); // DEBUG
        if (isTestRunning && timeLeft > 0) {
            const timerId = setInterval(() => setTimeLeft(prevTime => Math.max(0, prevTime - 1)), 1000);
            return () => clearInterval(timerId);
        } else if (isTestRunning && timeLeft === 0) {
            console.log('[EyeTrackingTest] Timer reached 0, calling handleStopTest.'); // DEBUG
            handleStopTest();
        }
    }, [isTestRunning, timeLeft, handleStopTest]);

    useEffect(() => {
        return () => {
            console.log('[EyeTrackingTest] Unmounting, cleaning up.'); // DEBUG
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            if (testTimeoutRef.current) clearTimeout(testTimeoutRef.current);
            if (targetAnimationRef.current) cancelAnimationFrame(targetAnimationRef.current);
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
                <p>Follow the yellow dot with your eyes while keeping your head still for 10 seconds.</p>
                {!isWebcamEnabled && <button className="primary-button" onClick={enableWebcam} disabled={isLoading}>{isLoading ? "Loading Model..." : "Enable Webcam"}</button>}
                {isWebcamEnabled && !isTestRunning && <button className="primary-button" onClick={handleStartTest}>Start 10 Second Test</button>}
                {isTestRunning && <p>Test in progress...</p>}
            </div>
            {testResults && chartData && (
                <div style={{ display: 'flex', gap: '2rem', width: '90%', maxWidth: '1000px', alignItems: 'stretch' }}>
                    <ResultsVisualization title="Eye Tracking Results" data={testResults} />
                    <div className="card" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <h3>Gaze vs Target Path</h3>
                        <Line data={chartData} options={{ scales: { x: { type: 'linear', min: 0, max: 1, ticks:{display:false} }, y: { type: 'linear', min: 0, max: 1, ticks:{display:false} } }, animation: { duration: 0 } }}/>
                    </div>
                </div>
            )}
        </div>
    );
};
export default EyeTrackingTest;