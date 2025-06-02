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

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// --- Constants ---
const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;
const TEST_DURATION = 10000; // 10 seconds

// --- Interfaces ---
interface GazeDataPoint { timestamp: number; target: { x: number; y: number }; gaze: { x: number; y: number } | null; }
interface GazeTestResults { trackingScore: number; pointsCollected: number; }

const EyeTrackingTest: React.FC = () => {
    // --- State Management ---
    const { landmarker, isLoading } = useMediaPipe('face');
    const [isWebcamEnabled, setIsWebcamEnabled] = useState(false);
    const [instructionsVisible, setInstructionsVisible] = useState(true);
    const [isTestRunning, setIsTestRunning] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [gazeHistory, setGazeHistory] = useState<GazeDataPoint[]>([]);
    const [testResults, setTestResults] = useState<GazeTestResults | null>(null);
    const [targetPosition, setTargetPosition] = useState({ x: 0.5, y: 0.5 });
    const [chartData, setChartData] = useState<any>(null);

    // --- Refs ---
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | null>(null);
    const testTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    // --- Core Logic ---
    const predictWebcam = useCallback(() => { /* ... same as before ... */ }, [landmarker, isTestRunning, targetPosition]);
    const enableWebcam = async () => { /* ... same as before ... */ };
    
    const handleStopTest = useCallback(() => {
        setIsTestRunning(false);
        setTimeLeft(0);

        if (gazeHistory.length > 0) {
            let totalDistance = 0, validPoints = 0;
            gazeHistory.forEach(point => {
                if (point.gaze) {
                    totalDistance += Math.hypot(point.target.x - point.gaze.x, point.target.y - point.gaze.y);
                    validPoints++;
                }
            });
            const averageError = totalDistance / validPoints;
            const trackingScore = Math.max(0, 100 - (averageError * 150)); // Scaled score
            setTestResults({ trackingScore: parseFloat(trackingScore.toFixed(2)), pointsCollected: validPoints });

            // Prepare chart data
            setChartData({
                datasets: [
                    {
                        label: 'Target Path',
                        data: gazeHistory.map(p => ({ x: p.target.x, y: p.target.y })),
                        borderColor: 'rgb(255, 204, 0)',
                        backgroundColor: 'rgba(255, 204, 0, 0.5)',
                        showLine: true,
                        pointRadius: 1,
                    },
                    {
                        label: 'Gaze Path',
                        data: gazeHistory.map(p => p.gaze ? { x: p.gaze.x, y: p.gaze.y } : null).filter(p => p),
                        borderColor: 'rgb(255, 0, 0)',
                        backgroundColor: 'rgba(255, 0, 0, 0.5)',
                        showLine: true,
                        pointRadius: 1,
                    },
                ],
            });
        }
    }, [gazeHistory]);

    const handleStartTest = () => {
        setInstructionsVisible(false);
        setGazeHistory([]);
        setTestResults(null);
        setChartData(null);
        setIsTestRunning(true);
        setTimeLeft(TEST_DURATION / 1000);

        testTimeoutRef.current = setTimeout(handleStopTest, TEST_DURATION);
    };

    // Effects for animation and timers...
    useEffect(() => { /* ...same animation effect... */ }, [isTestRunning]);
    useEffect(() => { /* ...same timer effect... */ }, [isTestRunning, timeLeft]);
    useEffect(() => {
        enableWebcam();
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            if (testTimeoutRef.current) clearTimeout(testTimeoutRef.current);
            if (videoRef.current?.srcObject) {
                (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
            }
        };
    }, [landmarker]);

    // --- Render JSX ---
    if (isLoading) return <p>Loading Model...</p>;

    if (instructionsVisible) {
        return (
            <div className="card">
                <h2>Eye Tracking Test Instructions</h2>
                <p>A yellow dot will appear and move around the screen for <strong>10 seconds</strong>.</p>
                <p>Keep your head still and follow the dot with your eyes only.</p>
                <button className="primary-button" onClick={handleStartTest} disabled={!isWebcamEnabled}>
                    {isWebcamEnabled ? "Start Test" : "Waiting for Webcam..."}
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
                    {isTestRunning ? `Time Left: ${timeLeft}` : "Test Finished"}
                </div>
            </div>
            {testResults && chartData && (
                <div style={{ display: 'flex', gap: '2rem', width: '90%', maxWidth: '1000px' }}>
                    <ResultsVisualization title="Eye Tracking Results" data={testResults} />
                    <div className="card" style={{ flexGrow: 1 }}>
                        <h3>Gaze vs Target Path</h3>
                        <Line data={chartData} options={{ scales: { x: { type: 'linear', min: 0, max: 1 }, y: { type: 'linear', min: 0, max: 1 } } }}/>
                    </div>
                </div>
            )}
        </div>
    );
};
export default EyeTrackingTest;