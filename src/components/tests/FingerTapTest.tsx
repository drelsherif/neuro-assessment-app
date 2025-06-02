import React, { useState, useRef, useCallback, useEffect } from 'react';
import useMediaPipe, { drawHandLandmarks } from '../../hooks/useMediaPipe';
import { analyzeTapData } from '../../utils/testCalculations'; // We no longer need calculateFingerTapDistance
import { HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { ResultsVisualization } from '../data/ResultsVisualization';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;
const TEST_DURATION = 10000; // 10 seconds

// --- New constants for movement-based tap detection ---
// Adjust these values based on testing on your iPhone
const MOVEMENT_THRESHOLD_PIXELS = 10; // How many pixels the fingertip needs to move to be considered part of a tap
const DEBOUNCE_TIME_MS = 200;      // Minimum time between registered taps (milliseconds)

interface TapTestResults {
    totalTaps: number;
    tapsPerSecond: number;
    averageTimeBetweenTaps: number;
    consistency: number;
}

const FingerTapTest: React.FC = () => {
    const { landmarker, isLoading } = useMediaPipe('hand');
    const [isWebcamEnabled, setIsWebcamEnabled] = useState(false);
    const [isTestRunning, setIsTestRunning] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [tapTimestamps, setTapTimestamps] = useState<number[]>([]);
    const [testResults, setTestResults] = useState<TapTestResults | null>(null);
    const [chartData, setChartData] = useState<any>(null);

    // --- Refs for tap detection logic ---
    const lastFingerTipY = useRef<number | null>(null);
    const lastTapTime = useRef<number>(0);

    // --- Debug States (Optional, can be removed later) ---
    const [debugMovement, setDebugMovement] = useState<number | null>(null);
    const [debugLastTapTime, setDebugLastTapTime] = useState<number>(0);


    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | null>(null);
    const testTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const predictWebcam = useCallback(() => {
        if (!videoRef.current || !canvasRef.current || !landmarker || !videoRef.current.srcObject) {
            if (requestRef.current !== null) requestRef.current = requestAnimationFrame(predictWebcam);
            return;
        }
        const handLandmarker = landmarker as HandLandmarker;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (video.readyState >= 2 && ctx) {
            const results: HandLandmarkerResult = handLandmarker.detectForVideo(video, performance.now());
            drawHandLandmarks(ctx, results, canvas.width, canvas.height);

            if (isTestRunning && results.landmarks && results.landmarks.length > 0) {
                const handLandmarks = results.landmarks[0]; // Assuming one hand
                const indexTip = handLandmarks[8]; // Index finger tip

                if (indexTip && canvasRef.current) {
                    const tipY = indexTip.y * canvasRef.current.height; // Y-coordinate in pixels

                    if (lastFingerTipY.current !== null) {
                        const movement = Math.abs(tipY - lastFingerTipY.current);
                        setDebugMovement(movement); // Update debug state

                        if (movement > MOVEMENT_THRESHOLD_PIXELS) {
                            const currentTime = Date.now();
                            if (currentTime - lastTapTime.current > DEBOUNCE_TIME_MS) {
                                setTapTimestamps(prev => [...prev, currentTime]);
                                lastTapTime.current = currentTime;
                                setDebugLastTapTime(currentTime); // Update debug state
                            }
                        }
                    }
                    lastFingerTipY.current = tipY;
                }
            } else if (!isTestRunning) {
                // Reset lastFingerTipY when test is not running to avoid large initial movement detection
                lastFingerTipY.current = null;
            }
        }
        requestRef.current = requestAnimationFrame(predictWebcam);
    }, [landmarker, isTestRunning]); // Removed wasTapped, using refs instead

    const handleStopTest = useCallback(() => {
        setIsTestRunning(false);
        setTimeLeft(0);
        if (testTimeoutRef.current) clearTimeout(testTimeoutRef.current);
        lastFingerTipY.current = null; // Reset for the next test

        setTapTimestamps(currentTimestamps => {
            if (currentTimestamps.length > 0) { // Changed to > 0 as even 1 tap can be a result
                const analysis = analyzeTapData(currentTimestamps);
                setTestResults(analysis);
                
                if (currentTimestamps.length > 1) {
                    const intervals = [];
                    for (let i = 1; i < currentTimestamps.length; i++) {
                        intervals.push(currentTimestamps[i] - currentTimestamps[i - 1]);
                    }
                    setChartData({
                        labels: intervals.map((_, index) => `Interval ${index + 1}`),
                        datasets: [{
                            label: 'Time Between Taps (ms)', data: intervals,
                            borderColor: 'rgb(75, 192, 192)', tension: 0.1,
                        }]
                    });
                } else {
                     setChartData(null); // No intervals for chart with 0 or 1 tap
                }
            } else {
                setTestResults({ totalTaps: 0, tapsPerSecond: 0, averageTimeBetweenTaps: 0, consistency: 0 });
                setChartData(null);
            }
            return currentTimestamps; 
        });
    }, []);
    
    const handleStartTest = () => {
        setTapTimestamps([]);
        setTestResults(null);
        setChartData(null);
        lastFingerTipY.current = null; // Reset for new test
        lastTapTime.current = 0;      // Reset for new test
        setDebugMovement(null);
        setDebugLastTapTime(0);
        setIsTestRunning(true); 
        setTimeLeft(TEST_DURATION / 1000);
        testTimeoutRef.current = setTimeout(handleStopTest, TEST_DURATION);
    };
    
    const enableWebcam = async () => { /* ...same logic... */ };
    useEffect(() => { /* ...same timer logic... */ }, [isTestRunning, timeLeft, handleStopTest]);
    useEffect(() => { /* ...same cleanup logic... */ }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', width: '100%' }}>
            <div style={{ position: 'relative', width: '90vw', maxWidth: '640px', aspectRatio: '640 / 480', border: '2px solid #ccc', borderRadius: '8px', overflow: 'hidden', background: '#000' }}>
                <video ref={videoRef} autoPlay playsInline style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                <canvas ref={canvasRef} width={VIDEO_WIDTH} height={VIDEO_HEIGHT} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, transform: 'scaleX(-1)' }} />
                <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, background: 'rgba(0,0,0,0.5)', color: 'white', padding: '10px 15px', borderRadius: '8px', fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {isTestRunning ? `Time Left: ${timeLeft}` : (testResults ? "Test Finished" : (isWebcamEnabled ? "Ready" : "Waiting Webcam"))}
                </div>
                {isTestRunning && <h2 style={{ position: 'absolute', bottom: 10, left: 10, zIndex: 10, background: 'rgba(255,255,255,0.8)', padding: '10px', borderRadius: '5px' }}>Taps: {tapTimestamps.length}</h2>}
            </div>
            <div className="card" style={{padding: '1rem'}}>
                <p>Tap your index finger (like tapping a desk) clearly and consistently for 10 seconds.</p>
                {!isWebcamEnabled && <button className="primary-button" onClick={enableWebcam} disabled={isLoading}>{isLoading ? "Loading Model..." : "Enable Webcam"}</button>}
                {isWebcamEnabled && !isTestRunning && <button className="primary-button" onClick={handleStartTest}>Start 10 Second Test</button>}
                {isTestRunning && <p>Test in progress...</p>}
            </div>

            {/* VISUAL DEBUGGER - REMOVE LATER */}
            <div style={{
                background: 'rgba(200,200,200,0.8)', padding: '10px', marginTop: '10px', borderRadius: '5px',
                fontSize: '12px', textAlign: 'left', maxWidth: '640px', width: '90vw'
            }}>
                <h4>Debug Info (Finger Tap - Movement Based):</h4>
                <p>isWebcamEnabled: {isWebcamEnabled.toString()}</p>
                <p>isTestRunning: {isTestRunning.toString()}</p>
                <p>Live Y Movement: {debugMovement === null ? 'N/A' : debugMovement.toFixed(2)}px</p>
                <p>MOVEMENT_THRESHOLD: {MOVEMENT_THRESHOLD_PIXELS}px</p>
                <p>Last Tap Time (Timestamp): {debugLastTapTime}</p>
                <p>DEBOUNCE_TIME: {DEBOUNCE_TIME_MS}ms</p>
            </div>

            {testResults && chartData && (
                <div style={{ display: 'flex', gap: '2rem', width: '90%', maxWidth: '1000px', alignItems: 'stretch', marginTop: '1rem' }}>
                    <ResultsVisualization title="Finger Tap Results" data={testResults} />
                    <div className="card" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <h3>Rhythm Analysis</h3>
                        <Line data={chartData} />
                    </div>
                </div>
            )}
        </div>
    );
};
export default FingerTapTest;